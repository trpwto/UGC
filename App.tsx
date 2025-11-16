
import React, { useState, useEffect } from 'react';
import SceneCard from './components/SceneCard';
import Spinner from './components/Spinner';
import { SCENE_STRUCTURES } from './constants';
import { Scene, GenerationStatus, SceneStructure } from './types';
import * as geminiService from './services/geminiService';
import DownloadIcon from './components/icons/DownloadIcon';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/SettingsPanel';
import RegenerateIcon from './components/icons/RegenerateIcon';
import Switch from './components/Switch';

const App: React.FC = () => {
  // Shared State
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(window.innerWidth > 768);
  const [activeTool, setActiveTool] = useState('ugc-tool');

  // UGC Tool State
  const [productImage, setProductImage] = useState<File | null>(null);
  const [modelImage, setModelImage] = useState<File | null>(null);
  const [productName, setProductName] = useState('');
  const [additionalBrief, setAdditionalBrief] = useState('');
  const [sceneStructureId, setSceneStructureId] = useState(SCENE_STRUCTURES[0].id);
  const [generateVoiceOver, setGenerateVoiceOver] = useState(true);
  const [addBackgroundMusic, setAddBackgroundMusic] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [voiceOverUrl, setVoiceOverUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegeneratingVo, setIsRegeneratingVo] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Personal Branding Tool State
  const [pbComments, setPbComments] = useState('');
  const [pbReferenceScript, setPbReferenceScript] = useState('');
  const [pbAdditionalBrief, setPbAdditionalBrief] = useState('');
  const [pbSceneCount, setPbSceneCount] = useState(4);
  const [pbScenes, setPbScenes] = useState<Scene[]>([]);
  const [pbVoiceOverUrl, setPbVoiceOverUrl] = useState<string | null>(null);
  const [isPbLoading, setIsPbLoading] = useState(false);
  const [pbGenerateVo, setPbGenerateVo] = useState(true);
  const [pbAddMusic, setPbAddMusic] = useState(false);
  const [isRegeneratingPbVo, setIsRegeneratingPbVo] = useState(false);
  const [pbLoadingMessage, setPbLoadingMessage] = useState('');


  // Sync scenes state with selected structure for UGC Tool
  useEffect(() => {
    if (activeTool === 'ugc-tool') {
        const selectedStructure = SCENE_STRUCTURES.find(s => s.id === sceneStructureId) || SCENE_STRUCTURES[0];
        const newScenes = selectedStructure.scenes.map((sceneConfig, index) => ({
            id: index + 1,
            title: sceneConfig.title,
            description: sceneConfig.description,
            image: '',
            script: '',
            overlayTextSuggestion: '',
            status: GenerationStatus.PENDING,
            videoPrompt: '',
        }));
        setScenes(newScenes);
    }
  }, [sceneStructureId, activeTool]);
  
  // Initialize or adjust scenes for Personal Branding Tool based on count
  useEffect(() => {
    if (activeTool === 'personal-branding') {
        if (pbScenes.length !== pbSceneCount) {
            const initialScenes = Array.from({ length: pbSceneCount }, (_, i) => ({
                id: i + 1,
                title: `Adegan ${i + 1}`,
                description: 'Konten personal branding',
                image: '',
                script: '',
                overlayTextSuggestion: '',
                status: GenerationStatus.PENDING,
                videoPrompt: `Animasi halus seolah model sedang berbicara dengan natural.`,
                errorMessage: ''
            }));
            setPbScenes(initialScenes);
        }
    }
  }, [activeTool, pbSceneCount, pbScenes.length]);


  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true); // Assume success after open
      setError(null);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // --- UGC Tool Handlers ---
  const ugcHandleVideoPromptChange = (sceneId: number, prompt: string) => setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, videoPrompt: prompt } : s));
  const ugcHandleScriptChange = (sceneId: number, script: string) => setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, script: script } : s));
  const ugcResetState = () => {
    const selectedStructure = SCENE_STRUCTURES.find(s => s.id === sceneStructureId) || SCENE_STRUCTURES[0];
    const initialScenes = selectedStructure.scenes.map((sceneConfig, index) => ({ id: index + 1, title: sceneConfig.title, description: sceneConfig.description, image: '', script: '', overlayTextSuggestion: '', status: GenerationStatus.PENDING, videoPrompt: '' }));
    setScenes(initialScenes);
    setVoiceOverUrl(null);
    setError(null);
    setIsLoading(false);
    setLoadingMessage('');
  };
  const handleGenerateInitialAssets = async () => {
    setError(null);
    const selectedStructure = SCENE_STRUCTURES.find(s => s.id === sceneStructureId)!;
    const modelIsRequired = selectedStructure.scenes.some(scene => scene.requiredParts.includes('model'));
    if (modelIsRequired && !modelImage) { setError(`Struktur adegan "${selectedStructure.name}" membutuhkan gambar model. Mohon unggah.`); return; }
    if (!productImage || !productName) { setError('Mohon unggah gambar produk dan masukkan nama produk.'); return; }
    ugcResetState();
    setIsLoading(true);
    try {
      setLoadingMessage('Menyiapkan aset...');
      const productPart = await geminiService.fileToGenerativePart(productImage);
      const modelPart = modelImage ? await geminiService.fileToGenerativePart(modelImage) : undefined;
      const imageParts = { product: productPart, model: modelPart };
      setLoadingMessage('Membuat naskah & saran teks...');
      const scriptData = await geminiService.generateScript(selectedStructure, productName, additionalBrief);
      const fullScript = Object.values(scriptData).filter((v, i) => i % 2 === 0).join(' ');
      setLoadingMessage('Membuat gambar...');
      const imageGenerationPromise = geminiService.generateUgcImages(selectedStructure, productName, additionalBrief, imageParts);
      const voiceOverPromise = generateVoiceOver ? geminiService.generateVoiceOver(fullScript).catch(e => { console.warn("Voice over failed, continuing...", e); return null; }) : Promise.resolve(null);
      const [images, voUrl] = await Promise.all([imageGenerationPromise, voiceOverPromise]);
      if (voUrl) setVoiceOverUrl(voUrl);
      const updatedScenes = scenes.map((scene, index) => ({ ...scene, image: images[index], script: scriptData[`scene${index + 1}_script`] || '', overlayTextSuggestion: scriptData[`scene${index + 1}_overlay`] || '', status: GenerationStatus.IMAGE_READY, videoPrompt: selectedStructure.scenes[index].videoPromptSuggestion(productName, additionalBrief) }));
      setScenes(updatedScenes);
    } catch (e: any) { console.error('Initial generation failed:', e); setError(e.message || 'Terjadi kesalahan tak terduga.'); setScenes(prev => prev.map(s => ({...s, status: GenerationStatus.ERROR, errorMessage: e.message}))); } finally { setIsLoading(false); setLoadingMessage(''); }
  };
  const handleRegenerateVoiceOver = async () => {
      if (!generateVoiceOver) return;
      setIsRegeneratingVo(true); setError(null);
      try { const fullScript = scenes.map(s => s.script).join(' '); if (!fullScript.trim()) { setError("Naskah tidak boleh kosong untuk membuat voice over."); return; } const voUrl = await geminiService.generateVoiceOver(fullScript); setVoiceOverUrl(voUrl); } catch (e: any) { console.error("Failed to regenerate voice over:", e); setError(e.message || "Gagal membuat ulang voice over."); } finally { setIsRegeneratingVo(false); }
  };
  const handleRegenerateImage = async (sceneId: number) => {
    const selectedStructure = SCENE_STRUCTURES.find(s => s.id === sceneStructureId)!;
    const sceneConfig = selectedStructure.scenes[sceneId - 1];
    if (sceneConfig.requiredParts.includes('model') && !modelImage) { setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: GenerationStatus.ERROR, errorMessage: 'Gambar model diperlukan untuk adegan ini.' } : s)); return; }
    if (!productImage) return;
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: GenerationStatus.GENERATING_IMAGE, errorMessage: '' } : s));
    try { const productPart = await geminiService.fileToGenerativePart(productImage); const modelPart = modelImage ? await geminiService.fileToGenerativePart(modelImage) : undefined; const imageParts = { product: productPart, model: modelPart }; const newImage = await geminiService.regenerateSingleImage(sceneId, selectedStructure, productName, additionalBrief, imageParts); setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, image: newImage, status: GenerationStatus.IMAGE_READY } : s)); } catch (e: any) { console.error(`Error regenerating image for scene ${sceneId}:`, e); setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: GenerationStatus.ERROR, errorMessage: e.message } : s)); }
  };
  const handleGenerateVideo = async (sceneId: number, customPrompt: string) => {
      const scene = scenes.find(s => s.id === sceneId); if (!scene || !scene.image) return;
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: GenerationStatus.GENERATING_VIDEO, errorMessage: '' } : s));
      try { const videoUrl = await geminiService.generateVideoFromImage(scene.image, customPrompt, scene.script, addBackgroundMusic); setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, videoUrl, status: GenerationStatus.COMPLETED } : s)); } catch (videoError: any) { console.error(`Error generating video for scene ${scene.id}:`, videoError); const errorMessage = videoError.message || 'Unknown error'; let displayError = 'Gagal membuat video.'; if (errorMessage.includes("Requested entity was not found.")) { setError("API Key tidak ditemukan. Mohon pilih ulang API key Anda."); setApiKeySelected(false); displayError = "API Key tidak ditemukan."; } else if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("429")) { displayError = "Batas kuota untuk key ini habis."; setError("Kuota API Key habis. Mohon pilih API key yang lain untuk melanjutkan."); setApiKeySelected(false); } setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, status: GenerationStatus.ERROR, errorMessage: displayError } : s)); }
  };
  const isAnySceneProcessing = scenes.some(s => s.status === GenerationStatus.GENERATING_IMAGE || s.status === GenerationStatus.GENERATING_VIDEO);

  // --- Personal Branding Tool Handlers ---
  const pbHandleVideoPromptChange = (sceneId: number, prompt: string) => setPbScenes(prev => prev.map(s => s.id === sceneId ? { ...s, videoPrompt: prompt } : s));
  const pbHandleScriptChange = (sceneId: number, script: string) => setPbScenes(prev => prev.map(s => s.id === sceneId ? { ...s, script: script } : s));
  const pbResetState = () => {
    const initialScenes = Array.from({ length: pbSceneCount }, (_, i) => ({ id: i + 1, title: `Adegan ${i + 1}`, description: 'Konten personal branding', image: '', script: '', overlayTextSuggestion: '', status: GenerationStatus.PENDING, videoPrompt: `Animasi halus seolah model sedang berbicara dengan natural.`, errorMessage: '' }));
    setPbScenes(initialScenes);
    setPbVoiceOverUrl(null);
    setError(null);
    setIsPbLoading(false);
    setPbLoadingMessage('');
  };
  const handleGeneratePbContent = async () => {
      if (!pbComments || !pbReferenceScript) { setError("Mohon isi kolom komentar dan naskah referensi."); return; }
      pbResetState();
      setIsPbLoading(true);
      try {
          setPbLoadingMessage('Menganalisis input & membuat naskah...');
          const { scenes: scenesData, images } = await geminiService.generatePersonalBrandingContent(pbComments, pbReferenceScript, pbAdditionalBrief, pbSceneCount);
          
          setPbLoadingMessage('Membuat voice over...');
          const fullScript = scenesData.map(s => s.script).join(' ');
          const voPromise = pbGenerateVo ? geminiService.generateVoiceOver(fullScript).catch(e => { console.warn("PB Voice over failed, continuing...", e); return null; }) : Promise.resolve(null);
          const voUrl = await voPromise;
          if(voUrl) setPbVoiceOverUrl(voUrl);

          const updatedScenes = pbScenes.map((scene, i) => ({
              ...scene,
              script: scenesData[i].script,
              overlayTextSuggestion: scenesData[i].overlay,
              videoPrompt: scenesData[i].imagePrompt, // Use the generated image prompt as a base for video animation prompt
              image: images[i],
              status: GenerationStatus.IMAGE_READY,
          }));
          setPbScenes(updatedScenes);
      } catch (e: any) { console.error('PB generation failed:', e); setError(e.message || 'Gagal membuat konten personal branding.'); setPbScenes(prev => prev.map(s => ({...s, status: GenerationStatus.ERROR, errorMessage: e.message}))); } finally { setIsPbLoading(false); setPbLoadingMessage(''); }
  };
   const handleRegeneratePbImage = async (sceneId: number) => {
    const scene = pbScenes.find(s => s.id === sceneId);
    if (!scene || !scene.videoPrompt) { // videoPrompt holds the image prompt
        setError("Prompt gambar tidak ditemukan untuk adegan ini.");
        return;
    }
    setPbScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: GenerationStatus.GENERATING_IMAGE, errorMessage: '' } : s));
    try {
        const newImage = await geminiService.generateImageFromPrompt(scene.videoPrompt);
        setPbScenes(prev => prev.map(s => s.id === sceneId ? { ...s, image: newImage, status: GenerationStatus.IMAGE_READY } : s));
    } catch (e: any) { console.error(`Error regenerating PB image for scene ${sceneId}:`, e); setPbScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: GenerationStatus.ERROR, errorMessage: e.message } : s)); }
  };
  const handleGeneratePbVideo = async (sceneId: number, customPrompt: string) => {
    const scene = pbScenes.find(s => s.id === sceneId); if (!scene || !scene.image) return;
    setPbScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: GenerationStatus.GENERATING_VIDEO, errorMessage: '' } : s));
    try { const videoUrl = await geminiService.generateVideoFromImage(scene.image, customPrompt, scene.script, pbAddMusic); setPbScenes(prev => prev.map(s => s.id === scene.id ? { ...s, videoUrl, status: GenerationStatus.COMPLETED } : s)); } catch (videoError: any) { console.error(`Error generating video for scene ${scene.id}:`, videoError); const errorMessage = videoError.message || 'Unknown error'; let displayError = 'Gagal membuat video.'; if (errorMessage.includes("Requested entity was not found.")) { setError("API Key tidak ditemukan. Mohon pilih ulang API key Anda."); setApiKeySelected(false); displayError = "API Key tidak ditemukan."; } else if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("429")) { displayError = "Batas kuota untuk key ini habis."; setError("Kuota API Key habis. Mohon pilih API key yang lain untuk melanjutkan."); setApiKeySelected(false); } setPbScenes(prev => prev.map(s => s.id === scene.id ? { ...s, status: GenerationStatus.ERROR, errorMessage: displayError } : s)); }
  };
  const handleRegeneratePbVoiceOver = async () => {
    if (!pbGenerateVo) return;
    setIsRegeneratingPbVo(true); setError(null);
    try { const fullScript = pbScenes.map(s => s.script).join(' '); if (!fullScript.trim()) { setError("Naskah tidak boleh kosong untuk membuat voice over."); return; } const voUrl = await geminiService.generateVoiceOver(fullScript); setPbVoiceOverUrl(voUrl); } catch (e: any) { console.error("Failed to regenerate PB voice over:", e); setError(e.message || "Gagal membuat ulang voice over."); } finally { setIsRegeneratingPbVo(false); }
  };
  const isAnyPbSceneProcessing = pbScenes.some(s => s.status === GenerationStatus.GENERATING_IMAGE || s.status === GenerationStatus.GENERATING_VIDEO);
  

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 text-gray-800">
        <Sidebar isExpanded={isSidebarExpanded} onToggle={() => setIsSidebarExpanded(prev => !prev)} activeTool={activeTool} onToolChange={(toolId) => { setError(null); setActiveTool(toolId); }} />
        
        {(isLoading || isRegeneratingVo || isPbLoading || isRegeneratingPbVo) && (
          <div className="fixed inset-0 bg-white bg-opacity-70 flex flex-col items-center justify-center z-50 text-gray-900">
            <Spinner />
            <p className="mt-4 text-lg font-semibold">{loadingMessage || pbLoadingMessage || 'Membuat ulang voice over...'}</p>
          </div>
        )}

        {/* --- Main Content --- */}
        {activeTool === 'ugc-tool' && (
          <>
            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="px-8 py-4 border-b border-gray-200">
                    <h1 className="text-xl font-bold text-gray-900">Generator UGC</h1>
                    <p className="text-sm text-gray-500">Buat konten UGC dengan AI dari gambar produk Anda</p>
                </header>
                <div className="flex-1 p-4 md:p-8 space-y-6">
                    <h2 className="text-lg font-semibold">Generasi Saat Ini <span className="text-sm text-gray-500 font-normal">({scenes.filter(s => s.image).length}/4 gambar selesai)</span></h2>
                    {voiceOverUrl && (
                      <div className="p-4 bg-white border border-gray-200 rounded-xl"><div className="flex flex-col sm:flex-row items-center justify-between gap-4"><div className="flex-1"><h3 className="text-md font-semibold text-gray-900 mb-1 sm:mb-0">Master Voice Over</h3><p className="text-xs text-gray-500">Satu track audio untuk seluruh video Anda.</p></div><div className="w-full sm:w-auto flex items-center gap-2"><audio controls src={voiceOverUrl} className="w-full max-w-xs h-10"></audio><button onClick={handleRegenerateVoiceOver} disabled={isRegeneratingVo || isLoading || isAnySceneProcessing} className="p-2 bg-white border border-gray-300 text-gray-700 rounded-full hover:bg-gray-100 transition disabled:opacity-50" aria-label="Buat Ulang Voice Over"><RegenerateIcon className="w-5 h-5" /></button><button onClick={() => handleDownload(voiceOverUrl, 'voice_over.mp3')} className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition" aria-label="Unduh Voice Over"><DownloadIcon className="w-5 h-5" /></button></div></div></div>
                    )}
                    <div className="grid grid-cols-1 gap-6">{scenes.map(scene => (<SceneCard key={scene.id} scene={scene} onRegenerateImage={handleRegenerateImage} onGenerateVideo={handleGenerateVideo} onVideoPromptChange={ugcHandleVideoPromptChange} onScriptChange={ugcHandleScriptChange} isVoiceOverEnabled={generateVoiceOver} />))}</div>
                </div>
            </main>
            <SettingsPanel productImage={productImage} modelImage={modelImage} productName={productName} additionalBrief={additionalBrief} sceneStructureId={sceneStructureId} generateVoiceOver={generateVoiceOver} addBackgroundMusic={addBackgroundMusic} onProductImageUpload={setProductImage} onModelImageUpload={setModelImage} onProductNameChange={setProductName} onAdditionalBriefChange={setAdditionalBrief} onSceneStructureChange={setSceneStructureId} onGenerateVoiceOverChange={setGenerateVoiceOver} onAddBackgroundMusicChange={setAddBackgroundMusic} onGenerate={handleGenerateInitialAssets} apiKeySelected={apiKeySelected} onSelectKey={handleSelectKey} isLoading={isLoading || isAnySceneProcessing} error={error} />
          </>
        )}

        {activeTool === 'personal-branding' && (
          <>
            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="px-8 py-4 border-b border-gray-200">
                    <h1 className="text-xl font-bold text-gray-900">Konten Personal Branding</h1>
                    <p className="text-sm text-gray-500">Buat konten dari umpan balik audiens dan inspirasi Anda</p>
                </header>
                <div className="flex-1 p-4 md:p-8 space-y-6">
                    <h2 className="text-lg font-semibold">Rancangan Konten <span className="text-sm text-gray-500 font-normal">({pbScenes.filter(s => s.image).length}/{pbSceneCount} adegan siap)</span></h2>
                    {pbVoiceOverUrl && (
                      <div className="p-4 bg-white border border-gray-200 rounded-xl"><div className="flex flex-col sm:flex-row items-center justify-between gap-4"><div className="flex-1"><h3 className="text-md font-semibold text-gray-900 mb-1 sm:mb-0">Master Voice Over</h3><p className="text-xs text-gray-500">Satu track audio untuk seluruh video {pbSceneCount} adegan Anda.</p></div><div className="w-full sm:w-auto flex items-center gap-2"><audio controls src={pbVoiceOverUrl} className="w-full max-w-xs h-10"></audio><button onClick={handleRegeneratePbVoiceOver} disabled={isRegeneratingPbVo || isPbLoading || isAnyPbSceneProcessing} className="p-2 bg-white border border-gray-300 text-gray-700 rounded-full hover:bg-gray-100 transition disabled:opacity-50" aria-label="Buat Ulang Voice Over"><RegenerateIcon className="w-5 h-5" /></button><button onClick={() => handleDownload(pbVoiceOverUrl, 'pb_voice_over.mp3')} className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition" aria-label="Unduh Voice Over"><DownloadIcon className="w-5 h-5" /></button></div></div></div>
                    )}
                    <div className="grid grid-cols-1 gap-6">{pbScenes.map(scene => (<SceneCard key={scene.id} scene={scene} onRegenerateImage={handleRegeneratePbImage} onGenerateVideo={handleGeneratePbVideo} onVideoPromptChange={pbHandleVideoPromptChange} onScriptChange={pbHandleScriptChange} isVoiceOverEnabled={pbGenerateVo} />))}</div>
                </div>
            </main>
            <aside className="w-full md:w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
                <header className="p-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Input & Pengaturan</h2><p className="text-xs text-gray-500">Konfigurasi konten personal branding</p></header>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    <div><label htmlFor="pb-comments" className="text-sm font-semibold text-gray-600 mb-2 block">Komentar Terdahulu</label><textarea id="pb-comments" rows={5} value={pbComments} onChange={(e) => setPbComments(e.target.value)} placeholder="Salin & tempel komentar relevan dari audiens Anda di sini..." className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-purple-500" disabled={isPbLoading} /></div>
                    <div><label htmlFor="pb-ref-script" className="text-sm font-semibold text-gray-600 mb-2 block">Naskah Referensi</label><textarea id="pb-ref-script" rows={5} value={pbReferenceScript} onChange={(e) => setPbReferenceScript(e.target.value)} placeholder="Tempelkan naskah dari konten yang ingin Anda tiru gaya dan hook-nya..." className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-purple-500" disabled={isPbLoading} /></div>
                    <div><label htmlFor="pb-brief" className="text-sm font-semibold text-gray-600 mb-2 block">Brief Tambahan (Opsional)</label><textarea id="pb-brief" rows={3} value={pbAdditionalBrief} onChange={(e) => setPbAdditionalBrief(e.target.value)} placeholder="Instruksi spesifik untuk AI..." className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-purple-500" disabled={isPbLoading} /></div>
                    <div>
                        <label htmlFor="pb-scene-count" className="text-sm font-semibold text-gray-600 mb-2 block">Jumlah Adegan</label>
                        <select
                            id="pb-scene-count"
                            value={pbSceneCount}
                            onChange={(e) => setPbSceneCount(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-purple-500"
                            disabled={isPbLoading}
                        >
                            <option value="4">4 Adegan (Cepat)</option>
                            <option value="6">6 Adegan (Standar)</option>
                            <option value="8">8 Adegan (Detail)</option>
                            <option value="10">10 Adegan (Lengkap)</option>
                        </select>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-gray-200"><Switch label="Buat Voice Over" enabled={pbGenerateVo} onChange={setPbGenerateVo} disabled={isPbLoading} /><Switch label="Tambah Musik Latar" enabled={pbAddMusic} onChange={setPbAddMusic} disabled={isPbLoading} /></div>
                </div>
                <footer className="p-4 border-t border-gray-200 bg-white">
                    <div className="text-xs text-gray-500 mb-4 text-center">Catatan: Pembuatan video memakan banyak sumber daya. Mohon pantau <a href="https://ai.dev/usage?tab=rate-limit" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">dasbor kuota</a> Anda.</div>
                    {!apiKeySelected ? ( <div className="flex flex-col items-center text-center"><p className="mb-2 text-sm text-red-500 font-medium">Pembuatan video memerlukan Kunci API.</p><p className="mb-3 text-xs text-gray-500">Lihat <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">dokumen penagihan</a>.</p><button onClick={handleSelectKey} className="w-full bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700">Pilih Kunci API</button></div> ) : ( <button onClick={handleGeneratePbContent} disabled={isPbLoading || !pbComments || !pbReferenceScript || isAnyPbSceneProcessing} className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"><span className="text-xl">👤✨</span>{isPbLoading ? 'Membuat...' : 'Buat Konten'}</button> )}
                    {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
                </footer>
            </aside>
          </>
        )}
    </div>
  );
};

export default App;
