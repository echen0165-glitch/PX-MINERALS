import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { pool, closeDatabase } from '../config/database.js';
import { hashSecret, passwordIsValid } from '../modules/auth/passwords.js';
const required=['BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_PASSWORD','BOOTSTRAP_ADMIN_FIRST_NAME','BOOTSTRAP_ADMIN_LAST_NAME','BOOTSTRAP_ADMIN_USERNAME','BOOTSTRAP_ADMIN_WAVE_NUMBER'];
if(required.some(k=>!process.env[k]))throw new Error(`Missing: ${required.filter(k=>!process.env[k]).join(', ')}`);if(!passwordIsValid(process.env.BOOTSTRAP_ADMIN_PASSWORD))throw new Error('Admin password invalid.');
if((await pool.query("SELECT 1 FROM users WHERE role='admin' LIMIT 1")).rowCount)throw new Error('Administrator already exists.');
const secret=new OTPAuth.Secret({size:20}).base32,client=await pool.connect();
try{await client.query('BEGIN');const user=await client.query(`INSERT INTO users (role,first_name,last_name,username,email,password_hash,birth_date,wave_number,client_code,status,email_verified_at) VALUES ('admin',$1,$2,$3,lower($4),$5,'1970-01-01',$6,$7,'active',now()) RETURNING id,email`,[process.env.BOOTSTRAP_ADMIN_FIRST_NAME,process.env.BOOTSTRAP_ADMIN_LAST_NAME,process.env.BOOTSTRAP_ADMIN_USERNAME,process.env.BOOTSTRAP_ADMIN_EMAIL,await hashSecret(process.env.BOOTSTRAP_ADMIN_PASSWORD),process.env.BOOTSTRAP_ADMIN_WAVE_NUMBER,`PX-ADMIN-${randomUUID().slice(0,8).toUpperCase()}`]);await client.query('INSERT INTO admin_totp_credentials (user_id,secret) VALUES ($1,$2)',[user.rows[0].id,secret]);await client.query('COMMIT');const totp=new OTPAuth.TOTP({issuer:'PX MINERALS',label:user.rows[0].email,algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)});console.log(`Admin created. Add this URI to an authenticator app:\n${totp.toString()}`)}catch(e){await client.query('ROLLBACK');throw e}finally{client.release();await closeDatabase()}
