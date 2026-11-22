import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {LogoScene} from './LogoScene';
import {brand} from './brand';

export type IntroProps = {background: 'transparent' | 'warm' | 'dark'; still: boolean};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export function FrameIntro({background, still}: IntroProps) {
  const currentFrame = useCurrentFrame();
  const f = still ? 140 : currentFrame;
  const dark = background === 'dark';
  const entrance = interpolate(f, [0, 18], [0, 1], clamp);
  return <AbsoluteFill style={{
    backgroundColor: background === 'transparent' ? 'transparent' : dark ? brand.darkWall : brand.wall,
    color: dark ? brand.ivory : brand.ink,
  }}>
    <AbsoluteFill style={{opacity: entrance}}>
      <LogoScene still={still}/>
    </AbsoluteFill>
  </AbsoluteFill>;
}
