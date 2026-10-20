/* Demo-only persistence. Live limits are enforced by PostgreSQL, not this file. */
(function (scope) {
  'use strict';
  const MAX_ATTEMPTS=2;
  const normalizeName=name=>String(name).trim().replace(/\s+/g,' ').toLowerCase();
  function createDemoStore(storage,roundId='demo-v3') {
    const key='vista_safety_mystery_'+roundId;
    let fallback={attempts:[],winner:null};
    function read(){try{const value=JSON.parse(storage?.getItem(key)||'null');if(value&&Array.isArray(value.attempts))return value;}catch{}return fallback;}
    function write(value){fallback=value;try{storage?.setItem(key,JSON.stringify(value));}catch{}}
    function remaining(name){return Math.max(0,MAX_ATTEMPTS-read().attempts.filter(a=>a.employee===normalizeName(name)).length);}
    function submit(name,code,winningCode){
      const employee=normalizeName(name);
      if(employee.length<2||String(name).length>60||!/^[0-9]{4}$/.test(code))return {status:'invalid'};
      const state=read();
      const used=state.attempts.filter(a=>a.employee===employee).length;
      if(used>=MAX_ATTEMPTS)return {status:'attempts_exhausted',attempts_remaining:0};
      const correct=code===winningCode;
      const status=!correct?'wrong':state.winner?'solved':'winner';
      state.attempts.push({employee,correct,at:new Date().toISOString()});
      if(status==='winner')state.winner=employee;
      write(state);
      return {status,attempts_remaining:MAX_ATTEMPTS-used-1,competition_id:roundId};
    }
    return Object.freeze({remaining,submit});
  }
  scope.VistaAttempts=Object.freeze({MAX_ATTEMPTS,normalizeName,createDemoStore});
})(globalThis);
