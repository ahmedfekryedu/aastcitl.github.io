// Real bundled Supabase SDK, synthetic HTTP responses; every external request is intercepted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CITL_TEST_NODE_MODULES?path.join(process.env.CITL_TEST_NODE_MODULES,'playwright'):'playwright');
const root=process.env.CITL_TEST_ROOT||path.resolve(__dirname,'..'),out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
const uid='11111111-1111-4111-8111-111111111111';
const user={id:uid,email:'test@example.invalid',full_name:'مدير اختبار محلي',role:'manager',department:'computer-lab',status:'active',is_active:true,permissions:{can_approve:true,can_manage_users:true,can_delete:true},linked_instructors:['محاضر تجريبي']};
const lecture={id:1,instructor:'محاضر تجريبي',course_name:'مقرر اختبار محلي',course_code:'CITL101',room_name:'H 104',day_of_week:'Monday',time_slot:'08:30 - 10:20',status:'active',period_order:1};
const exam={id:1,exam_date:'2026-09-07',start_time:'09:00:00',end_time:'11:00:00',academic_level:1,group_number:1,course_language:'A',course_code:'CITL201',course_name:'امتحان اليوم التجريبي',room_name:'H 104',instructor:'محاضر تجريبي'};
const tables={profiles:[user],academic_schedule:[lecture,{...lecture,id:2,room_name:'H 108',time_slot:'10:30 - 12:20',period_order:2}],meetings:[{id:1,user_id:uid,title:'اجتماع اختبار',department:'computer-lab',date:'2026-09-07',start_time:'10:00',end_time:'11:00',status:'confirmed',created_at:'2026-09-01T08:00:00Z',profiles:user}],settings:[{id:1,start_hour:8,end_hour:18}],site_settings:[{setting_key:'tv_display_config',setting_value:{activeRooms:['H 104'],examsEnabled:false,slideDurationSeconds:60}},{setting_key:'tv_poster_config',setting_value:{enabled:true,rotationSeconds:8}},{setting_key:'news_config',setting_value:{text:'خبر اختبار',sliderVal:50}}],tv_posters:[{id:1,title:'صورة إعلان تجريبية',image_url:'/CITL_Banner.png',is_active:true,display_order:1,created_at:'2026-09-01',fit_mode:'contain'}],exam_schedule:[exam,{...exam,id:2,exam_date:'2026-09-08',course_name:'امتحان الغد لا يظهر'}]};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:4102444800})).toString('base64url')+'.fixture';
(async()=>{
 let browser,server;const checks=[],errors=[],calls=[];let failAcademic=false,blockedEmail=true;
 async function check(name,fn){try{await fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:e.message});}}
 try{
  server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return;}try{if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.png':'image/png'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Africa/Cairo',serviceWorkers:'block'});
  await context.addInitScript(({user,token})=>{localStorage.setItem('sb-main-auth',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:user.id,email:user.email,role:'authenticated',aud:'authenticated',app_metadata:{},user_metadata:{}}}));localStorage.setItem('currentUser',JSON.stringify(user));sessionStorage.setItem('has_visited','true');},{user,token});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===base)return route.continue();
   if(u.hostname==='xgqukdbonzukxrpjovmb.supabase.co'){
    const table=u.pathname.split('/').pop();calls.push({path:u.pathname,method:req.method(),query:u.search});
    if(u.pathname.startsWith('/rest/v1/rpc/')){
     if(['citl_effective_schedule','citl_room_names','citl_booking_hours','citl_patch_setting','citl_attendance_counts'].includes(table))return route.fulfill({status:404,json:{code:'PGRST202',message:'Function not installed'}});
     if(table==='citl_presence_track')return route.fulfill({json:{ignored:true}});
     return route.fulfill({json:{ok:true,notifications:[],terms:[],visitors:[],profiles:[user]}});
    }
    if(u.pathname.startsWith('/auth/v1/'))return route.fulfill({json:user});
    if(req.method()!=='GET'&&req.method()!=='HEAD')return route.fulfill({status:403,json:{message:'Test blocks mutations'}});
    if(table==='academic_schedule'&&failAcademic)return route.fulfill({status:503,json:{message:'Synthetic temporary outage'}});
    let rows=[...(tables[table]||[])];for(const [key,value] of u.searchParams){if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3));}
    const count=rows.length,offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||1000);rows=rows.slice(offset,offset+limit);
    const headers={'content-range':`0-${Math.max(0,rows.length-1)}/${count}`};const single=(req.headers().accept||'').includes('vnd.pgrst.object');
    if(req.method()==='HEAD')return route.fulfill({status:200,headers,body:''});
    return route.fulfill({headers,json:single?(rows[0]||null):rows});
   }
   if(u.pathname.includes('email.min.js')&&!blockedEmail)return route.fulfill({body:'window.emailjs={init(){},send(){return Promise.resolve()}}',contentType:'application/javascript'});
   return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push({page:page.url(),message:e.message}));await page.clock.setFixedTime(new Date('2026-09-07T06:00:00Z'));
  await page.goto(base+'/dashboard/');
  await check('Dashboard starts with EmailJS CDN unavailable',async()=>{await page.waitForFunction(()=>window.sb?.auth&&typeof currentUser!=='undefined'&&currentUser?.id);await page.locator('#global-loader').waitFor({state:'hidden'});});
  blockedEmail=false;await page.goto(base+'/dashboard/');await page.waitForFunction(()=>window.sb?.auth);
  await check('Dashboard reads meetings and settings from existing tables',async()=>{await page.waitForFunction(()=>typeof meetings!=='undefined'&&meetings.length===1);assert.equal(await page.evaluate(()=>meetings[0].title),'اجتماع اختبار');});
  await check('Dashboard administration buttons and poster images work',async()=>{await page.locator('#admin-panel-btn').click();await page.locator('#admin-panel-modal.show').waitFor();await page.evaluate(()=>switchAdminTab('news'));await page.evaluate(()=>loadTvPosterAdminData());await page.locator('#admin-posters-grid img').first().waitFor({state:'attached'});assert.equal(await page.locator('#admin-posters-grid img').first().getAttribute('src'),'/CITL_Banner.png');await page.waitForFunction(()=>document.querySelector('#admin-posters-grid img')?.naturalWidth>0);await page.screenshot({path:path.join(out,'dashboard-posters.png')});await page.evaluate(()=>closeModal('admin-panel-modal'));});
  await page.goto(base+'/schedules/');
  const day=page.locator('.custom-dropdown').filter({has:page.locator('#filter-day')});
  await check('Schedule dropdown opens and a real click displays rows',async()=>{await page.waitForFunction(()=>document.getElementById('global-loader').classList.contains('hidden'));await day.locator('.custom-dropdown-display').click();await day.locator('.custom-dropdown-options.show').waitFor();await day.locator('[data-value="Monday"]').click();await page.waitForFunction(()=>document.getElementById('results-grid').textContent.includes('مقرر اختبار محلي'));});
  await check('Refresh error preserves already displayed rows and clears loader',async()=>{const before=await page.locator('#results-grid').innerText();failAcademic=true;await page.locator('button[onclick="applyFilters()"]').click();await page.waitForFunction(()=>document.getElementById('global-loader').classList.contains('hidden'));assert.equal(await page.locator('#results-grid').innerText(),before);failAcademic=false;});
  failAcademic=true;await page.reload();
  await check('Schedule dropdowns stay usable when initial data fails',async()=>{await page.waitForFunction(()=>document.getElementById('global-loader').classList.contains('hidden'));await day.locator('.custom-dropdown-display').click();await day.locator('.custom-dropdown-options.show').waitFor();});
  failAcademic=false;await page.reload();
  await check('Schedule data recovers after transient failure',async()=>{await page.waitForFunction(()=>document.getElementById('global-loader').classList.contains('hidden'));await day.locator('.custom-dropdown-display').click();await day.locator('[data-value="Monday"]').click();await page.waitForFunction(()=>document.getElementById('results-grid').textContent.includes('مقرر اختبار محلي'));await page.screenshot({path:path.join(out,'schedules.png'),fullPage:false});});
  await page.goto(base+'/today/');
  await check('Original QR page requests today only even with a future-date URL',async()=>{await page.goto(base+'/today/?date=2026-09-08&view=academic');await page.waitForFunction(()=>document.getElementById('exams-container').textContent.includes('امتحان اليوم التجريبي'));assert.equal(await page.locator('input[type=date],[role=tab],#share').count(),0);assert.equal((await page.locator('#exams-container').innerText()).includes('امتحان الغد لا يظهر'),false);});
  await page.goto(base+'/tv_display/');
  await check('Original TV clock, lectures and poster slide work',async()=>{await page.waitForFunction(()=>document.getElementById('current-time').textContent!=='00:00');await page.waitForFunction(()=>document.getElementById('content-container').textContent.includes('مقرر اختبار محلي'));await page.evaluate(()=>showPoster(tvPosters[0],1,1));await page.locator('#content-container img').first().waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('#content-container img')?.naturalWidth>0);});
  blockedEmail=true;await page.goto(base+'/smrm/');
  await check('Room booking starts without the external email library',async()=>{await page.waitForFunction(()=>window.sb?.auth&&typeof currentUser!=='undefined'&&currentUser?.id);await page.locator('#global-loader').waitFor({state:'hidden'});});
  await check('No dependency on absent database functions',async()=>assert.equal(calls.some(c=>/citl_effective_schedule|citl_room_names|citl_booking_hours|citl_patch_setting|citl_attendance_counts/.test(c.path)),false));
  if(!process.env.CITL_BASELINE)await check('No uncaught browser exceptions',async()=>assert.deepEqual(errors,[]));
  const result={passed:checks.every(c=>c.passed),network:'Real bundled Supabase SDK; all external HTTP mocked/blocked; no production writes',checks,errors};fs.writeFileSync(path.join(out,process.env.CITL_BASELINE?'baseline.json':'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed&&!process.env.CITL_BASELINE)process.exitCode=1;
 }finally{if(browser)await browser.close();if(server)server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
