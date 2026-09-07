import '/app/favicon.js';

const form=document.querySelector('#login-form'),error=document.querySelector('#login-error'),password=document.querySelector('#password');
const verificationLink=document.createElement('a');verificationLink.href='/app/verify-email.html';verificationLink.textContent='J’ai reçu un code';document.querySelector('.auth-links').append(verificationLink);
document.querySelector('#show-password').addEventListener('click',()=>password.type=password.type==='password'?'text':'password');
form.addEventListener('submit',async(event)=>{event.preventDefault();error.textContent='';const email=document.querySelector('#email').value.trim();const response=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:password.value})});const payload=await response.json().catch(()=>({}));if(!response.ok){if(payload.error?.code==='ACCOUNT_INACTIVE')sessionStorage.setItem('pxVerificationEmail',email);error.textContent=payload.error?.message??'Connexion impossible.';return}window.location.replace('/app/');});
