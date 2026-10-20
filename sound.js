/* User-provided result clips. Audio is armed by the first user interaction. */
(function (scope) {
  'use strict';
  const CLIPS=Object.freeze({
    winner:'assets/audio/kaiba-one-winner.mp3',
    solved:'assets/audio/rizz-sound-effect.mp3',
    wrong:'assets/audio/the-price-is-right-losing-horn.mp3'
  });
  function create(options={}) {
    let context=null,enabled=true,active=null,version=0;
    const loads=new Map();
    const contextFactory=options.contextFactory||(()=>new (scope.AudioContext||scope.webkitAudioContext)());
    const fetcher=options.fetcher||((url)=>scope.fetch(url));
    function getContext(){if(!context){try{context=contextFactory();}catch{}}return context;}
    function load(kind){
      if(loads.has(kind))return loads.get(kind);
      const ctx=getContext();
      if(!ctx||!CLIPS[kind])return Promise.resolve(null);
      const promise=(async()=>{
        const response=await fetcher(CLIPS[kind]);
        if(!response.ok)throw Error('Audio file unavailable');
        return await ctx.decodeAudioData(await response.arrayBuffer());
      })().catch(()=>{loads.delete(kind);return null;});
      loads.set(kind,promise);return promise;
    }
    function arm(){
      if(!enabled)return;
      const ctx=getContext();if(!ctx)return;
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
      // Decode early so the clips can play after an asynchronous live response.
      for(const kind of Object.keys(CLIPS))void load(kind);
    }
    function stopActive(){
      if(!active)return;
      const source=active;active=null;
      try{source.stop();}catch{}
      try{source.disconnect();}catch{}
    }
    function stop(){++version;stopActive();}
    function setEnabled(value){enabled=Boolean(value);if(!enabled)stop();else arm();}
    async function play(kind){
      if(!enabled)return false;
      arm();const ctx=getContext();if(!ctx)return false;
      if(kind==='click'){
        if(ctx.state!=='running')return false;
        const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime;
        osc.type='sine';osc.frequency.value=540;
        gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.035,t+.01);
        gain.gain.exponentialRampToValueAtTime(.001,t+.04);
        osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+.06);
        osc.onended=()=>{osc.disconnect();gain.disconnect();};return true;
      }
      if(!CLIPS[kind])return false;
      const request=++version;stopActive();
      const buffer=await load(kind);
      if(!buffer||!enabled||request!==version||ctx.state!=='running')return false;
      try{
        const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);
        active=source;source.onended=()=>{if(active===source)active=null;source.disconnect();};source.start();
        return true;
      }catch{stopActive();return false;}
    }
    return Object.freeze({arm,play,setEnabled,stop});
  }
  scope.VistaSound=Object.freeze({create,CLIPS});
})(globalThis);
