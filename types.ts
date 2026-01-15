
export enum Emocion {
  NEUTRAL = 'neutral',
  FELIZ = 'feliz',
  TRISTE = 'triste',
  ENOJADA = 'enojada',
  SORPRENDIDA = 'sorprendida'
}

export interface MensajeTranscripcion {
  texto: string;
  autor: 'usuario' | 'azumi';
  timestamp: number;
}

export interface EstadoAsistente {
  estaConectada: boolean;
  estaHablando: boolean;
  emocionActual: Emocion;
  nivelConfianza: number;
}

export interface ConfiguracionAzumi {
  colorTema: 'indigo' | 'rose' | 'emerald' | 'amber' | 'cyan';
  sensibilidadMicro: number;
  intensidadAnimacion: number;
  mostrarTranscripcion: boolean;
}
