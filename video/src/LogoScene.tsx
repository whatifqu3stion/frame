import {useEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {brand} from './brand';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);

function roundedPath<T extends THREE.Path>(p: T, w: number, h: number, r: number): T {
  const x = -w / 2, y = -h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  p.closePath();
  return p;
}

function makeGeometry(w: number, h: number, radius: number, hole?: [number, number]) {
  const shape = roundedPath(new THREE.Shape(), w, h, radius);
  if (hole) shape.holes.push(roundedPath(new THREE.Path(), hole[0], hole[1], 0.018));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24, bevelEnabled: true, bevelSegments: 6,
    steps: 1, bevelSize: 0.045, bevelThickness: 0.05, curveSegments: 16,
  });
  g.translate(0, 0, -0.12);
  g.computeVertexNormals();
  return g;
}

// An actual studio reflection environment, built locally with no HDR download.
function StudioLighting() {
  const {gl} = useThree();
  const target = useMemo(() => {
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(room, 0.04);
    room.dispose();
    generator.dispose();
    return target;
  }, [gl]);
  useEffect(() => () => target.dispose(), [target]);
  return <>
    <primitive object={target.texture} attach="environment"/>
    <ambientLight intensity={0.45}/>
    <directionalLight position={[-2, 10, 5]} color="#fff3de" intensity={3.3} castShadow
      shadow-mapSize={[512, 512]} shadow-radius={24} shadow-bias={-0.0002}
      shadow-normalBias={0.025} shadow-camera-left={-5} shadow-camera-right={5}
      shadow-camera-top={5} shadow-camera-bottom={-5} shadow-camera-near={0.1} shadow-camera-far={24}/>
    <directionalLight position={[4, 1, 3]} color="#c6e9ff" intensity={1.8}/>
    <directionalLight position={[-2, -3, -2]} color="#a1c9df" intensity={2.4}/>
  </>;
}

const markers = [
  {x: -1.09, y: 2.245, vertical: true},
  {x: 1.09, y: 2.245, vertical: true},
  {x: 1.755, y: 1.58, vertical: false},
  {x: 1.755, y: -1.58, vertical: false},
  {x: 1.09, y: -2.245, vertical: true},
  {x: -1.09, y: -2.245, vertical: true},
  {x: -1.755, y: -1.58, vertical: false},
  {x: -1.755, y: 1.58, vertical: false},
];

function Symbol({still}: {still: boolean}) {
  const currentFrame = useCurrentFrame();
  const f = still ? 140 : currentFrame;
  const ring = useMemo(() => makeGeometry(2.35, 3.33, 0.085, [2.01, 2.99]), []);
  const bar = useMemo(() => makeGeometry(0.56, 0.17, 0.085), []);
  useEffect(() => () => {ring.dispose(); bar.dispose();}, [ring, bar]);
  const arrival = interpolate(f, [0, 68], [0, 1], {...clamp, easing: ease});
  const angle = interpolate(f, [0, 76, 135], [-0.85, 0.28, 0.24], {...clamp, easing: ease});
  const scale = interpolate(arrival, [0, 1], [0.83, 1]);
  const material = <meshPhysicalMaterial color={brand.mineralBlue} metalness={0.58}
    roughness={0.24} clearcoat={0.42} clearcoatRoughness={0.19} envMapIntensity={1.65}/>;
  return <group rotation={[0.10 * (1 - arrival) + 0.12, angle, 0.045 * (1 - arrival)]}
    position={[0, 0.48 * (1 - arrival), 0]} scale={scale}>
    <mesh geometry={ring} castShadow>{material}</mesh>
    {markers.map((marker, i) => {
      const settle = interpolate(f, [5 + i * 1.5, 44 + i * 1.5], [0, 1], {...clamp, easing: ease});
      const spread = 1 + 0.30 * (1 - settle);
      return <mesh key={i} geometry={bar} castShadow
        position={[marker.x * spread, marker.y * spread, (1 - settle) * (i % 2 ? -0.45 : 0.45)]}
        rotation={[0, 0, marker.vertical ? Math.PI / 2 : 0]}>
        {material}
      </mesh>;
    })}
  </group>;
}

export function LogoScene({still = false}: {still?: boolean}) {
  const {width, height} = useVideoConfig();
  return <ThreeCanvas width={width} height={height} orthographic shadows={{type: THREE.PCFShadowMap}}
    camera={{position: [0, 1.3, 12], zoom: 102, near: 0.1, far: 100}}
    gl={{alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15}}
    style={{position: 'absolute', top: -25, left: 0, background: 'transparent'}}>
    <StudioLighting/>
    <Symbol still={still}/>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.07, 0]}>
      <planeGeometry args={[200, 200]}/>
      <shadowMaterial transparent opacity={0.13} depthWrite={false}/>
    </mesh>
  </ThreeCanvas>;
}
