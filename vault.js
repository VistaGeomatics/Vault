(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const {normalizeName,createDemoStore}=VistaAttempts;
  const config=window.VISTA_CONFIG||{};
  const apiUrl=config.SUPABASE_URL?config.SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/safe-submit':'';
  const live=Boolean(apiUrl);
  let local;try{local=window.localStorage;}catch{}
  const demo=createDemoStore(local,'demo-v3-release');
  const vault=$('vault'),form=$('safe-form'),name=$('employee-name'),code=$('entry-code');
  let busy=false,checking=false,remaining=2,closed=false,backendReady=!live;
  let title='Safety Mystery',roundId=null,soundEnabled=true,quotaVersion=0;
  const sound=VistaSound.create();
  function armAudio(){sound.arm();}
  document.addEventListener('pointerdown',armAudio,{passive:true});
  document.addEventListener('keydown',armAudio);
  function play(kind){void sound.play(kind);}
  $('sound-toggle').addEventListener('click',()=>{
    soundEnabled=!soundEnabled;
    sound.setEnabled(soundEnabled);
    $('sound-toggle').querySelector('span').textContent=soundEnabled?'Sound on':'Sound off';
    $('sound-toggle').setAttribute('aria-label',soundEnabled?'Turn sound off':'Turn sound on');
    $('sound-toggle').setAttribute('aria-pressed',String(soundEnabled));
    if(soundEnabled)play('click');
  });
  function message(text,kind=''){const node=$('screen-alert');node.textContent=text;node.className='screen-alert'+(kind?' '+kind:'');}
  function controls(){
    const locked=busy||checking||remaining===0||closed||!backendReady||vault.classList.contains('open');
    for(const element of form.querySelectorAll('button,input'))element.disabled=element===name?busy||vault.classList.contains('open'):locked;
    vault.classList.toggle('exhausted',remaining===0);
    $('attempts-label').textContent=name.value.trim().length<2?'2 ATTEMPTS PER EMPLOYEE':checking?'CHECKING ATTEMPTS…':remaining===0?'NO ATTEMPTS REMAINING':remaining+' ATTEMPT'+(remaining===1?'':'S')+' REMAINING';
  }
  function slots(){
    code.value=code.value.replace(/[^0-9]/g,'').slice(0,4);
    const count=4,group=$('code-slots');
    group.style.setProperty('--slots',count);group.classList.toggle('long',count>6);group.replaceChildren();
    for(let i=0;i<count;i++){const slot=document.createElement('span');slot.textContent=code.value[i]||'';group.append(slot);}
  }
  code.addEventListener('input',slots);
  document.querySelectorAll('[data-digit]').forEach(button=>button.addEventListener('click',()=>{
    if(button.disabled)return;code.value+=button.dataset.digit;slots();code.focus();play('click');
  }));
  $('clear-key').addEventListener('click',()=>{code.value='';slots();code.focus();message('CODE CLEARED');play('click');});
  code.addEventListener('keydown',e=>{if(e.key==='Backspace')play('click');});
  async function request(payload){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
      const result=await response.json();
      if(!result||typeof result.status!=='string')throw Error('Unexpected backend response');
      if(!response.ok&&!['rate_limited','attempts_exhausted','inactive'].includes(result.status))throw Error('Backend unavailable');
      return result;
    }finally{clearTimeout(timer);}
  }
  async function quota(){
    const entered=name.value.trim(),version=++quotaVersion;
    if(entered.length<2){remaining=2;checking=false;controls();return;}
    if(!live){remaining=demo.remaining(entered);if(remaining===0)message('TWO ATTEMPTS USED · THIS CASE IS LOCKED','error');else message('AWAITING CODE ENTRY');controls();return;}
    if(!backendReady)return;
    checking=true;controls();
    try{
      const result=await request({action:'attempt_status',employee_name:entered});
      if(version!==quotaVersion||normalizeName(name.value)!==normalizeName(entered))return;
      if(result.status==='inactive'){closed=true;message('THIS COMPETITION IS CLOSED','error');}
      else if(['ready','attempts_exhausted'].includes(result.status)&&Number.isInteger(result.attempts_remaining)){
        remaining=Math.max(0,Math.min(2,result.attempts_remaining));roundId=result.competition_id;
        message(remaining===0?'TWO ATTEMPTS USED · THIS CASE IS LOCKED':'AWAITING CODE ENTRY',remaining===0?'error':'');
      }else throw Error('Backend update needed');
    }catch{if(version===quotaVersion){backendReady=false;message('BACKEND UPDATE NEEDED · CONTACT YOUR ADMIN','error');}}
    finally{if(version===quotaVersion){checking=false;controls();}}
  }
  name.addEventListener('input',()=>{
    ++quotaVersion;checking=false;
    remaining=live?2:demo.remaining(name.value);
    if(!live)message(remaining===0?'TWO ATTEMPTS USED · THIS CASE IS LOCKED':'AWAITING CODE ENTRY',remaining===0?'error':'');
    controls();
  });
  name.addEventListener('change',()=>{void quota();});
  name.addEventListener('blur',()=>{void quota();});
  async function status(){
    try{
      const response=await fetch(apiUrl,{cache:'no-store'});if(!response.ok)throw Error('Status unavailable');
      const data=await response.json();
      if(typeof data.open!=='boolean'||data.max_attempts!==2)throw Error('Update needed');
      backendReady=true;closed=!data.open;roundId=data.competition_id;
      if(typeof data.title==='string'&&data.title.length<=100)title=data.title;
      $('mode-label').textContent=closed?'COMPETITION CLOSED':'LIVE COMPETITION';
      $('mode-chip').classList.toggle('live',!closed);
      $('round-title').textContent=title.toUpperCase();
      if(closed)message('THIS COMPETITION IS CLOSED','error');
    }catch{backendReady=false;$('mode-label').textContent='BACKEND UNAVAILABLE';$('mode-chip').classList.add('unavailable');message('BACKEND UPDATE NEEDED · CONTACT YOUR ADMIN','error');}
    controls();
  }
  function confetti(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const layer=$('confetti-layer');layer.replaceChildren();
    for(let i=0;i<55;i++){const p=document.createElement('i');p.className='confetti';p.style.left=Math.random()*100+'%';p.style.setProperty('--color',['#d2b15f','#e7d9b6','#85ac86'][i%3]);p.style.setProperty('--duration',(2+Math.random()*2)+'s');p.style.setProperty('--delay',(Math.random()*.5)+'s');p.style.setProperty('--drift',((Math.random()-.5)*180)+'px');layer.append(p);}
    setTimeout(()=>layer.replaceChildren(),5000);
  }
  function openVault(result,employee){
    const won=result.status==='winner';
    $('result-icon').textContent=won?'🏆':'🔓';
    $('result-heading').textContent=won?'YOU CRACKED THE CASE!':'CODE CORRECT!';
    $('result-message').textContent=won?'You are the first to solve '+title+'.':'You solved the case. Another employee opened the safe first.';
    $('result-name').textContent=employee;
    $('result-detail').textContent=!live?'DEMO RESULT · Saved only in this browser.':won?'Your winning entry has been recorded. Claim your prize from the safety manager.':'Your correct entry has been recorded.';
    $('chamber').hidden=false;vault.classList.add('open',won?'winner':'later');
    $('vault-door').setAttribute('inert','');
    message('ACCESS GRANTED','success');play(result.status);controls();
    if(won)setTimeout(confetti,850);
    setTimeout(()=>$('relock').focus({preventScroll:true}),1900);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||checking||vault.classList.contains('open'))return;
    const employee=name.value.trim().replace(/\s+/g,' ');slots();
    if(employee.length<2){message('ENTER YOUR FIRST AND LAST NAME','error');name.focus();return;}
    if(!/^[0-9]{4}$/.test(code.value)){message('ENTER EXACTLY 4 NUMBERS','error');code.focus();return;}
    if(closed||!backendReady)return;
    if(remaining===0){message('TWO ATTEMPTS USED · THIS CASE IS LOCKED','error');return;}
    busy=true;controls();armAudio();message('CHECKING THE EVIDENCE…','pending');
    try{
      const result=live?await request({employee_name:employee,code:code.value}):demo.submit(employee,code.value,'4826');
      if(['winner','solved','wrong','attempts_exhausted'].includes(result.status)){
        if(!Number.isInteger(result.attempts_remaining))throw Error('Attempt limit update required');
        remaining=Math.max(0,Math.min(2,result.attempts_remaining));roundId=result.competition_id||roundId;
      }
      switch(result.status){
        case 'winner':case 'solved':openVault(result,employee);break;
        case 'wrong':vault.classList.remove('wrong');void vault.offsetWidth;vault.classList.add('wrong');play('wrong');message(remaining===0?'INCORRECT · TWO ATTEMPTS USED · CASE LOCKED':'INCORRECT CODE · ONE ATTEMPT REMAINS','error');code.value='';slots();setTimeout(()=>vault.classList.remove('wrong'),500);break;
        case 'attempts_exhausted':message('TWO ATTEMPTS USED · THIS CASE IS LOCKED','error');play('wrong');break;
        case 'inactive':closed=true;message('THIS COMPETITION IS CLOSED','error');break;
        case 'rate_limited':message('NETWORK LIMIT · TRY AGAIN LATER','error');break;
        default:throw Error('Submission unavailable');
      }
    }catch{message('ENTRY NOT CONFIRMED · PLEASE TRY AGAIN','error');}
    finally{busy=false;controls();}
  });
  $('relock').addEventListener('click',()=>{
    vault.classList.remove('open','winner','later','wrong');$('vault-door').removeAttribute('inert');
    name.value='';code.value='';remaining=2;slots();message('AWAITING CODE ENTRY');controls();
    setTimeout(()=>{$('chamber').hidden=true;name.focus({preventScroll:true});},1800);
  });
  window.addEventListener('storage',()=>{if(!live){remaining=demo.remaining(name.value);controls();}});
  slots();controls();if(live){$('mode-label').textContent='CONNECTING…';void status();}
})();
