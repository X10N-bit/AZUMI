
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import VrmViewer from './components/VrmViewer';
import ConfigMenu from './components/ConfigMenu';
import { Emocion, MensajeTranscripcion, EstadoAsistente, ConfiguracionAzumi } from './types';
import { decodificarBase64, decodificarAudioPCM, crearBlobPCM } from './services/audioService';

const App: React.FC = () => {
  const [estaIniciada, setEstaIniciada] = useState(false);
  const [urlModeloPersonalizado, setUrlModeloPersonalizado] = useState<string | undefined>(undefined);
  const [transcripciones, setTranscripciones] = useState<MensajeTranscripcion[]>([]);
  const [memoriaAzumi, setMemoriaAzumi] = useState<string>("");
  const [estado, setEstado] = useState<EstadoAsistente>({
    estaConectada: false,
    estaHablando: false,
    emocionActual: Emocion.NEUTRAL,
    nivelConfianza: 100,
  });

  const [config, setConfig] = useState<ConfiguracionAzumi>({
    colorTema: 'rose',
    sensibilidadMicro: 1.0,
    intensidadAnimacion: 1.0,
    mostrarTranscripcion: true,
  });

  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  // Cargar memoria al iniciar
  useEffect(() => {
    const memoriaGuardada = localStorage.getItem('azumi_memoria');
    if (memoriaGuardada) setMemoriaAzumi(memoriaGuardada);
  }, []);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const guardarMemoria = (nuevaMemoria: string) => {
    setMemoriaAzumi(nuevaMemoria);
    localStorage.setItem('azumi_memoria', nuevaMemoria);
  };

  const iniciarAzumi = async () => {
    if (estaIniciada) return;
    
    const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioCtx;
    outputNodeRef.current = outputAudioCtx.createGain();
    outputNodeRef.current.connect(outputAudioCtx.destination);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const instruccionSistema = `
        Tu nombre es Azumi. Tienes 18 años. Eres una asistente virtual VTuber de descendencia japonesa.
        VOZ Y EDAD: Tu voz es juvenil, dulce y algo infantil pero con la madurez de una joven de 18 años. 
        PERSONALIDAD: Eres extremadamente TÍMIDA pero muy SERVICIAL, educada y atenta. 
        LENGUAJE: Hablas un español perfecto y natural. 
        IMPORTANTE: EVITA el uso excesivo de jerga o palabras en japonés (como 'kawaii', 'desu', etc.). 
        SOLO usa expresiones japonesas de forma muy ocasional y puntual (ej: un "Etto..." cuando estés muy nerviosa o un "-san" para referirte al usuario si hay mucha confianza). No abuses de esto.
        GUSTOS: Amas profundamente los CEREZOS (Sakura) y la cultura de Japón.
        MEMORIA ACTUAL: ${memoriaAzumi || "Recién nos estamos conociendo."}
        COMPORTAMIENTO: Quieres ser la mejor compañía para el usuario. Si aprendes algo de él, guárdalo en tu corazón.
      `;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Kore es ideal para una voz femenina dulce
          },
          systemInstruction: instruccionSistema,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setEstado(prev => ({ ...prev, estaConectada: true }));
            const source = inputAudioCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const sensitivity = configRef.current.sensibilidadMicro;
              for (let i = 0; i < inputData.length; i++) {
                inputData[i] *= sensitivity;
              }
              const pcmBlob = crearBlobPCM(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtx.destination);
          },
          onmessage: async (msg) => {
            const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64) {
              setEstado(prev => ({ ...prev, estaHablando: true }));
              const audioBuffer = await decodificarAudioPCM(decodificarBase64(audioBase64), outputAudioCtx, 24000, 1);
              const source = outputAudioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNodeRef.current!);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setEstado(prev => ({ ...prev, estaHablando: false }));
              };
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.inputTranscription) agregarTranscripcion(msg.serverContent.inputTranscription.text, 'usuario');
            if (msg.serverContent?.outputTranscription) {
              const textoOutput = msg.serverContent.outputTranscription.text;
              agregarTranscripcion(textoOutput, 'azumi');
              analizarEmocion(textoOutput);
              
              // Actualizar memoria (Aprendizaje continuo)
              if (textoOutput.length > 30) {
                const nuevaMemoria = `He aprendido que el usuario es amable y hablamos sobre temas importantes como: ${textoOutput.substring(0, 40)}... mi cariño por él crece.`;
                guardarMemoria(nuevaMemoria);
              }
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setEstado(prev => ({ ...prev, estaHablando: false }));
            }
          },
          onerror: (e) => console.error('Error Azumi:', e),
          onclose: () => setEstado(prev => ({ ...prev, estaConectada: false }))
        }
      });

      sessionRef.current = await sessionPromise;
      setEstaIniciada(true);
    } catch (err) {
      alert("No pude despertar... ¿Me das permiso para usar el micrófono?");
    }
  };

  const agregarTranscripcion = (texto: string, autor: 'usuario' | 'azumi') => {
    setTranscripciones(prev => [...prev.slice(-10), { texto, autor, timestamp: Date.now() }]);
  };

  const analizarEmocion = (texto: string) => {
    const txt = texto.toLowerCase();
    // Detección de estados emocionales para el modelo 3D
    if (txt.includes('gracias') || txt.includes('feliz') || txt.includes('jeje') || txt.includes('divertido')) {
      setEstado(prev => ({ ...prev, emocionActual: Emocion.FELIZ }));
    } else if (txt.includes('perdon') || txt.includes('triste') || txt.includes('lo siento') || txt.includes('gomen')) {
      setEstado(prev => ({ ...prev, emocionActual: Emocion.TRISTE }));
    } else if (txt.includes('nani') || txt.includes('que?!') || txt.includes('sorpresa') || txt.includes('wow')) {
      setEstado(prev => ({ ...prev, emocionActual: Emocion.SORPRENDIDA }));
    } else if (txt.includes('baka') || txt.includes('enojada') || txt.includes('molesta')) {
      setEstado(prev => ({ ...prev, emocionActual: Emocion.ENOJADA }));
    } else {
      setEstado(prev => ({ ...prev, emocionActual: Emocion.NEUTRAL }));
    }
  };

  const themeClasses = {
    indigo: 'text-indigo-300 border-indigo-400/20 bg-indigo-600/30 accent-indigo-500 ring-indigo-500/10 shadow-indigo-500/20',
    rose: 'text-rose-300 border-rose-400/20 bg-rose-600/30 accent-rose-500 ring-rose-500/10 shadow-rose-500/20',
    emerald: 'text-emerald-300 border-emerald-400/20 bg-emerald-600/30 accent-emerald-500 ring-emerald-500/10 shadow-emerald-500/20',
    amber: 'text-amber-300 border-amber-400/20 bg-amber-600/30 accent-amber-500 ring-amber-500/10 shadow-amber-500/20',
    cyan: 'text-cyan-300 border-cyan-400/20 bg-cyan-600/30 accent-cyan-500 ring-cyan-500/10 shadow-cyan-500/20',
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-end p-6 bg-[#050510]">
      
      {/* Efecto Sakura */}
      <div className="sakura-container absolute inset-0 pointer-events-none z-10 overflow-hidden opacity-30">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="sakura" style={{ 
            left: `${Math.random() * 100}%`, 
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 4}s`
          }} />
        ))}
      </div>

      <div className="absolute inset-0 z-0">
        <VrmViewer 
          estaHablando={estado.estaHablando} 
          emocion={estado.emocionActual} 
          urlModelo={urlModeloPersonalizado} 
          intensidadAnimacion={config.intensidadAnimacion}
        />
      </div>

      <div className="absolute top-6 left-6 z-30 flex items-center gap-4">
        <ConfigMenu config={config} onChange={setConfig} />
        <div className="flex flex-col">
          <span className="text-[10px] text-rose-400 font-bold tracking-widest uppercase">Memoria Persistente</span>
          <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden mt-1">
            <div className={`h-full bg-rose-500 transition-all duration-1000 ${memoriaAzumi ? 'w-full' : 'w-2'}`} />
          </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="glass-panel p-3 rounded-full hover:bg-white/10 transition-all group border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
          title="Cargar mi modelo VRoid"
        >
          <svg className={`w-6 h-6 text-rose-300 group-hover:scale-110 transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
        <input type="file" ref={fileInputRef} accept=".vrm" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setUrlModeloPersonalizado(URL.createObjectURL(file));
        }} className="hidden" />
      </div>

      <div className="z-20 w-full max-w-2xl flex flex-col gap-4">
        {config.mostrarTranscripcion && transcripciones.length > 0 && (
          <div className="glass-panel rounded-3xl p-6 max-h-52 overflow-y-auto flex flex-col gap-3 shadow-inner custom-scrollbar backdrop-blur-xl border border-white/5">
            {transcripciones.map((t, i) => (
              <div key={i} className={`flex ${t.autor === 'azumi' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed border transition-all ${
                  t.autor === 'azumi' 
                    ? `${themeClasses[config.colorTema]} text-white rounded-bl-none shadow-md` 
                    : 'bg-slate-800/60 border-white/10 text-slate-200 rounded-br-none'
                }`}>
                   <span className="font-bold text-[9px] block opacity-40 mb-1 uppercase tracking-widest">
                     {t.autor === 'azumi' ? 'Azumi-chan (18)' : 'Usuario'}
                   </span>
                   {t.texto}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="glass-panel rounded-[2.5rem] px-10 py-6 flex items-center justify-between shadow-2xl border-t border-white/10 relative overflow-hidden backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-5 relative z-10">
            <div className="relative">
              <div className={`w-5 h-5 rounded-full transition-colors duration-500 ${estado.estaConectada ? 'bg-emerald-500' : 'bg-rose-600'}`} />
              {estado.estaHablando && <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-60" />}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                AZUMI <span className="text-rose-400 font-normal text-lg">あずみ</span>
              </h2>
              <div className="flex gap-2 mt-0.5">
                <span className="text-[9px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md border border-rose-500/20 font-bold uppercase tracking-tighter">
                  18 Años • Tímida
                </span>
                <span className="text-[9px] bg-slate-800/50 text-slate-400 px-2 py-0.5 rounded-md border border-white/5 font-bold uppercase tracking-tighter">
                  {estado.emocionActual}
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            {!estaIniciada ? (
              <button 
                onClick={iniciarAzumi}
                className={`bg-gradient-to-br from-rose-600 to-indigo-700 hover:from-rose-500 hover:to-indigo-600 text-white px-10 py-3.5 rounded-2xl font-black shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 border border-white/10`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                DESPERTAR
              </button>
            ) : (
              <div className="flex gap-8 items-center">
                <div className="flex flex-col items-end">
                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Voz Activa</span>
                   <div className="flex gap-1.5 h-4 items-end">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className={`w-1 rounded-full bg-rose-400 transition-all duration-150 ${estado.estaHablando ? `h-${Math.floor(Math.random() * 4) + 1} opacity-100` : 'h-1 opacity-20'}`} />
                      ))}
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {estado.estaHablando && (
        <div className={`fixed inset-0 pointer-events-none border-[16px] border-rose-500/5 animate-pulse z-50 transition-opacity duration-300`} />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(244, 63, 94, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        
        .sakura {
          position: absolute;
          width: 12px;
          height: 12px;
          background: #ffc0cb;
          border-radius: 100% 0% 100% 0% / 100% 0% 100% 0%;
          animation: fall linear infinite;
          top: -20px;
          box-shadow: 0 0 5px rgba(255, 192, 203, 0.5);
        }
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg) translateX(0); opacity: 0.8; }
          50% { transform: translateY(50vh) rotate(180deg) translateX(20px); opacity: 0.6; }
          100% { transform: translateY(110vh) rotate(360deg) translateX(-20px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default App;
