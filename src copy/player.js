// Player module - builds a small accessible audio player into
// #audio-player-container. Good practices: DOM creation, event cleanup,
// localStorage resume position, and minimal dependencies.

const AUDIO_SRC = 'assets/music/Waagal - Somārudrā Throatsinging Sitar Live Looping.mp3';
const AUDIO_TITLE = 'Waagal - Somārudrā';
const YT_URL = 'https://www.youtube.com/watch?v=fU6HLjKnywU';
const STORAGE_KEY = 'rigveda_audio_pos_v1';

function formatTime(s){
  if (!isFinite(s) || s === null) return '0:00';
  const m = Math.floor(s/60); const sec = Math.floor(s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}

function createPlayer(container){
  // Root
  const root = document.createElement('div');
  root.id = 'audio-player';
  root.setAttribute('role','region');
  root.setAttribute('aria-label','Audio player');

  // Audio element (hidden)
  const audio = document.createElement('audio');
  audio.id = 'player-audio';
  audio.src = AUDIO_SRC;
  audio.preload = 'metadata';

  // Play/Pause button
  const playBtn = document.createElement('button');
  playBtn.className = 'ap-btn';
  playBtn.id = 'ap-play';
  playBtn.title = 'Play';
  playBtn.type = 'button';
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-pressed','false');

  // Restart (seek to start) button
  const restartBtn = document.createElement('button');
  restartBtn.className = 'ap-btn ap-btn-small';
  restartBtn.title = 'Restart';
  restartBtn.type = 'button';
  restartBtn.textContent = '⟲';

  // Loop toggle
  const loopBtn = document.createElement('button');
  loopBtn.className = 'ap-btn ap-btn-small';
  loopBtn.title = 'Loop';
  loopBtn.type = 'button';
  loopBtn.textContent = '🔁';
  loopBtn.setAttribute('aria-pressed','false');

  // Title + external link
  const meta = document.createElement('div');
  meta.className = 'ap-meta';
  const titleEl = document.createElement('div');
  titleEl.className = 'ap-label';
  titleEl.textContent = AUDIO_TITLE;
  const link = document.createElement('a');
  link.href = YT_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'ap-link';
  link.textContent = 'Watch on YouTube';
  meta.appendChild(titleEl);
  meta.appendChild(link);

  // Controls wrapper
  const controls = document.createElement('div');
  controls.className = 'ap-controls';

  // Seek wrap
  const seekWrap = document.createElement('div');
  seekWrap.id = 'ap-seek-wrap';

  const seek = document.createElement('input');
  seek.id = 'ap-seek';
  seek.type = 'range';
  seek.min = 0;
  seek.max = 100;
  seek.step = 0.1;
  seek.value = 0;
  seek.setAttribute('aria-label','Seek');

  const times = document.createElement('div');
  times.id = 'ap-times';
  const cur = document.createElement('span'); cur.id = 'ap-cur'; cur.textContent = '0:00';
  const slash = document.createTextNode(' / ');
  const dur = document.createElement('span'); dur.id = 'ap-dur'; dur.textContent = '0:00';
  times.appendChild(cur); times.appendChild(slash); times.appendChild(dur);

  seekWrap.appendChild(seek);
  seekWrap.appendChild(times);

  // group buttons so they can be centered and spaced evenly
  const btns = document.createElement('div');
  btns.className = 'ap-btns';
  btns.appendChild(playBtn);
  btns.appendChild(restartBtn);
  btns.appendChild(loopBtn);

  controls.appendChild(btns);
  controls.appendChild(seekWrap);
  controls.appendChild(meta);

  root.appendChild(audio);
  root.appendChild(controls);

  container.appendChild(root);

  // --- Behavior ---
  let seekDragging = false;
  let wasPlaying = false;
  const LOOP_KEY = 'rigveda_audio_loop_v1';
  // restore loop flag from storage
  try{ const rawL = localStorage.getItem(LOOP_KEY); if (rawL === '1') { audio.loop = true; loopBtn.setAttribute('aria-pressed','true'); loopBtn.classList.add('active'); } } catch(e){}

  function savePos(){
    try{ localStorage.setItem(STORAGE_KEY, String(audio.currentTime || 0)); } catch(e){}
  }

  // Volume control based on screen state:
  // - Start screen (#overlay visible): 100% volume
  // - Main screen (#overlay hidden, no mandal overlay): 10% volume
  // - Mandal overlay (#mandal-overlay visible): 5% volume
  function setVolume(v){ try{ audio.volume = Math.max(0, Math.min(1, v)); } catch(e){} }

  function checkAndSetVolume(){
    try{
      const startOverlay = document.getElementById('overlay');
      const mandalOverlay = document.getElementById('mandal-overlay');
      
      // Check if mandal overlay is visible
      const isMandalVisible = mandalOverlay && (()=>{
        const style = getComputedStyle(mandalOverlay);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return parseFloat(style.opacity) > 0;
      })();
      
      // Check if start overlay is visible
      const isStartVisible = startOverlay && (()=>{
        const style = getComputedStyle(startOverlay);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const opacity = parseFloat(style.opacity);
        return opacity > 0.5; // threshold to detect start screen
      })();

      if (isMandalVisible) {
        // Mandal overlay visible: 10% volume
        setVolume(0.10);
      } else if (isStartVisible) {
        // Start screen visible: 100% volume
        setVolume(1.0);
      } else {
        // Main screen (neither overlay visible): 20% volume
        setVolume(0.20);
      }
    } catch(e){}
  }

  // Observe overlay attribute/style changes
  const startOverlay = document.getElementById('overlay');
  let overlayObserver = null;
  let bodyObs = null;
  
  // Initial volume check
  checkAndSetVolume();
  
  if (startOverlay){
    overlayObserver = new MutationObserver(()=>{
      // debounce brief toggles
      setTimeout(checkAndSetVolume, 40);
    });
    overlayObserver.observe(startOverlay, { attributes: true, attributeFilter: ['style','class','aria-hidden'] });
  }
  
  // Also observe body to detect mandal overlay creation/changes
  bodyObs = new MutationObserver(()=> setTimeout(checkAndSetVolume, 40));
  bodyObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  
  // include cleanup in destroy
  const oldDestroy = destroy;
  destroy = function(){
    try{ 
      overlayObserver && overlayObserver.disconnect(); 
      bodyObs && bodyObs.disconnect(); 
    } catch(e){}
    oldDestroy();
  };

  // Load stored position when metadata available
  audio.addEventListener('loadedmetadata', ()=>{
    seek.max = Math.max(0, audio.duration || 0);
    dur.textContent = formatTime(audio.duration);
    // restore position
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const val = raw ? Number(raw) : 0;
      if (val && isFinite(val) && val < audio.duration - 3) {
        audio.currentTime = val;
      }
    } catch(e){}
  });

  // Attempt autoplay (best-effort). Many browsers will block autoplay with sound; we try and silently handle rejection.
  // If autoplay is blocked the user can press Play.
  try {
    // small timeout to allow browser to settle
    setTimeout(()=>{
      const p = audio.play();
      if (p && p.catch) p.catch((err)=>{
        // autoplay was likely blocked; keep UI ready for user interaction
        // console.debug('Autoplay blocked or failed:', err);
      });
    }, 120);
  } catch(e) {}

  audio.addEventListener('timeupdate', ()=>{
    if (!seekDragging) seek.value = audio.currentTime;
    cur.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('play', ()=>{
    playBtn.textContent = '❚❚';
    playBtn.setAttribute('aria-pressed','true');
  });
  audio.addEventListener('pause', ()=>{
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-pressed','false');
  });
  audio.addEventListener('ended', ()=>{
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-pressed','false');
    savePos();
  });

  // Restart behavior
  restartBtn.addEventListener('click', ()=>{
    audio.currentTime = 0;
    if (audio.paused) {
      // make it obvious to user
      cur.textContent = formatTime(0);
    }
  });

  // Loop toggle behavior
  loopBtn.addEventListener('click', ()=>{
    const newState = !audio.loop;
    audio.loop = newState;
    loopBtn.setAttribute('aria-pressed', String(!!newState));
    if (newState) loopBtn.classList.add('active'); else loopBtn.classList.remove('active');
    try{ localStorage.setItem(LOOP_KEY, newState ? '1' : '0'); } catch(e){}
  });

  // Update storage periodically
  const saveInterval = setInterval(()=>{ if (!audio.paused) savePos(); }, 3000);

  // Play/pause
  playBtn.addEventListener('click', ()=>{
    if (audio.paused) audio.play().catch(()=>{});
    else audio.pause();
  });

  // Seek behavior
  seek.addEventListener('input', (e)=>{
    cur.textContent = formatTime(Number(e.target.value));
  });
  seek.addEventListener('change', (e)=>{
    audio.currentTime = Number(e.target.value);
    savePos();
  });
  seek.addEventListener('mousedown', ()=>{ seekDragging = true; wasPlaying = !audio.paused; if (wasPlaying) audio.pause(); });
  seek.addEventListener('mouseup', ()=>{ seekDragging = false; if (wasPlaying) audio.play(); });

  // Spacebar controls (avoid interfering with inputs)
  const onKey = (e)=>{
    if (e.code === 'Space' && document.activeElement && document.activeElement.tagName !== 'INPUT'){
      e.preventDefault(); playBtn.click();
    }
    // r -> restart, l -> loop toggle
    if (e.key === 'r' && document.activeElement && document.activeElement.tagName !== 'INPUT'){
      restartBtn.click();
    }
    if (e.key === 'l' && document.activeElement && document.activeElement.tagName !== 'INPUT'){
      loopBtn.click();
    }
  };
  window.addEventListener('keydown', onKey);

  // Cleanup hook in case needed in future
  function destroy(){
    clearInterval(saveInterval);
    window.removeEventListener('keydown', onKey);
    audio.pause();
    try{ container.removeChild(root); } catch(e){}
  }

  return { audio, playBtn, seek, destroy };
}

// Initialize on DOMContentLoaded or immediately if ready
function init(){
  const container = document.getElementById('audio-player-container');
  if (!container) return;
  createPlayer(container);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

export default { init };
