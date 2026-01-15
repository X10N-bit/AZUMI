
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Emocion } from '../types';

interface Props {
  estaHablando: boolean;
  emocion: Emocion;
  urlModelo?: string;
  intensidadAnimacion: number;
}

const VrmViewer: React.FC<Props> = ({ estaHablando, emocion, urlModelo, intensidadAnimacion }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const clockRef = useRef(new THREE.Clock());

  const defaultUrl = 'https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models/VRM1_Constraint_Sample.vrm';
  const urlFinal = urlModelo || defaultUrl;

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(30.0, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 20.0);
    camera.position.set(0.0, 1.4, 2.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(light);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const cargarModelo = (url: string) => {
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        VRMUtils.deepDispose(vrmRef.current.scene);
        vrmRef.current = null;
      }

      loader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm;
          vrmRef.current = vrm;
          if (vrm.meta && vrm.meta.specVersion === '0.0') {
             VRMUtils.rotateVRM0(vrm);
          }
          scene.add(vrm.scene);
        },
        undefined,
        (error) => {
          if (url !== defaultUrl) cargarModelo(defaultUrl);
        }
      );
    };

    cargarModelo(urlFinal);

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const deltaTime = clockRef.current.getDelta();

      if (vrmRef.current) {
        vrmRef.current.update(deltaTime);

        // Respiración ajustada por intensidadAnimacion
        const chest = vrmRef.current.humanoid.getNormalizedBoneNode('chest');
        if (chest) {
          chest.rotation.x = Math.sin(Date.now() * 0.0015 * intensidadAnimacion) * (0.015 * intensidadAnimacion);
        }

        // Habla ajustada por intensidadAnimacion
        if (estaHablando) {
          const mouthOpen = Math.abs(Math.sin(Date.now() * 0.018 * intensidadAnimacion)) * 0.8;
          vrmRef.current.expressionManager.setValue('aa', mouthOpen);
        } else {
          vrmRef.current.expressionManager.setValue('aa', 0);
        }

        vrmRef.current.expressionManager.setValue('happy', emocion === Emocion.FELIZ ? 1 : 0);
        vrmRef.current.expressionManager.setValue('sad', emocion === Emocion.TRISTE ? 1 : 0);
        vrmRef.current.expressionManager.setValue('angry', emocion === Emocion.ENOJADA ? 1 : 0);
        vrmRef.current.expressionManager.setValue('surprised', emocion === Emocion.SORPRENDIDA ? 1 : 0);
      }

      renderer.render(scene, camera);
    };

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [urlFinal, intensidadAnimacion]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default VrmViewer;
