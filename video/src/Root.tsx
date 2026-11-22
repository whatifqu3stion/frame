import {Composition, Still} from 'remotion';
import {FrameIntro} from './FrameIntro';
import {video} from './brand';
import {ViewingGuide, guideFps, guideFrames} from './ViewingGuide';

export function Root() {
  return <>
    <Composition id="ViewingGuide" component={ViewingGuide} width={720} height={540} fps={guideFps} durationInFrames={guideFrames}/>
    <Composition id="FrameTransparent" component={FrameIntro} {...video}
      defaultProps={{background: 'transparent', still: false}}/>
    <Composition id="FramePreview" component={FrameIntro} {...video}
      defaultProps={{background: 'warm', still: false}}/>
    <Composition id="FrameDarkPreview" component={FrameIntro} {...video}
      defaultProps={{background: 'dark', still: false}}/>
    <Composition id="FrameSymbol" component={FrameIntro} {...video} height={1080}
      defaultProps={{background: 'transparent', still: false}}/>
    <Still id="FramePoster" component={FrameIntro} width={video.width} height={video.height}
      defaultProps={{background: 'transparent', still: true}}/>
  </>;
}
