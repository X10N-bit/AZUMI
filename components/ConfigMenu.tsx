
import React from 'react';
import { ConfiguracionAzumi } from '../types';

interface Props {
  config: ConfiguracionAzumi;
  onChange: (newConfig: ConfiguracionAzumi) => void;
}

const ConfigMenu: React.FC<Props> = ({ config, onChange }) => {
  const [abierto, setAbierto] = React.useState(false);

  const colores = [
    { id: 'indigo', bg: 'bg-indigo-500' },
    { id: 'rose', bg: 'bg-rose-500' },
    { id: 'emerald', bg: 'bg-emerald-500' },
    { id: 'amber', bg: 'bg-amber-500' },
    { id: 'cyan', bg: 'bg-cyan-500' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(!abierto)}
        className="glass-panel p-3 rounded-full hover:bg-white/10 transition-all group shadow-lg"
        title="Configuración de Azumi"
      >
        <svg className={`w-6 h-6 text-${config.colorTema}-300 transition-transform duration-500 ${abierto ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {abierto && (
        <div className="absolute top-14 left-0 w-72 glass-panel rounded-2xl p-5 shadow-2xl z-50 border border-white/20 flex flex-col gap-5 animate-in fade-in slide-in-from-top-4 duration-200">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Color de Interfaz</label>
            <div className="flex gap-2">
              {colores.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onChange({ ...config, colorTema: c.id as any })}
                  className={`w-6 h-6 rounded-full ${c.bg} transition-transform ${config.colorTema === c.id ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'}`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sensibilidad Mic</label>
              <span className="text-[10px] text-white font-mono">{config.sensibilidadMicro.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={config.sensibilidadMicro}
              onChange={(e) => onChange({ ...config, sensibilidadMicro: parseFloat(e.target.value) })}
              className={`w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-${config.colorTema}-500`}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intensidad Animación</label>
              <span className="text-[10px] text-white font-mono">{config.intensidadAnimacion.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.1"
              value={config.intensidadAnimacion}
              onChange={(e) => onChange({ ...config, intensidadAnimacion: parseFloat(e.target.value) })}
              className={`w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-${config.colorTema}-500`}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ver Transcripción</label>
            <button
              onClick={() => onChange({ ...config, mostrarTranscripcion: !config.mostrarTranscripcion })}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.mostrarTranscripcion ? `bg-${config.colorTema}-500` : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.mostrarTranscripcion ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigMenu;
