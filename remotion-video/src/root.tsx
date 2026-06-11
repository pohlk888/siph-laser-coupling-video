import React from 'react';
import {Composition} from 'remotion';
import {SiPHCouplingVideo} from './siph-coupling-video';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SiPHCouplingVideo"
      component={SiPHCouplingVideo}
      durationInFrames={270}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
