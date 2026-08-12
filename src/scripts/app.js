/* ====================== Dados ====================== */
const AREA_COLORS = {
  "Cível":"#1E223F","Trabalhista":"#B58642","Tributário":"#3F5276",
  "Penal-Criminal":"#8c6239","Família e Sucessões":"#a9885a",
  "Recuperação Judicial":"#5b6a94","Falência":"#454b6e","Pública":"#6b7299",
  "Administrativo":"#2c3357","Ambiental":"#8a7043","Bancário":"#7d8199",
  "Imobiliário":"#9aa0b8","Previdenciário":"#c4a878","Propriedade intelectual":"#4a5273",
  "Outros":"#b8bccb","Outras":"#b8bccb"
};
const PALETTE = ["#1E223F","#B58642","#3F5276","#CFA36E","#5b6a94","#8c6239","#6b7299","#a9885a","#454b6e","#7d8199","#8a7043","#2c3357","#9aa0b8","#b8bccb"];
function colorFor(area,i){ return AREA_COLORS[area] || PALETTE[i % PALETTE.length]; }

const NUM = n => (n==null?0:n).toLocaleString('pt-BR');
const NUM1 = n => (n==null?0:n).toLocaleString('pt-BR',{maximumFractionDigits:0});

let GRUPOS = []; // {cod, nome, proc, ativos, encerrados, horas, horasEst, mov, prazos, aud, reun, area:{}}

/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */
// Data-corte dos dados (aparece no cabeçalho). Atualizar junto com a mensal.
const DATA_CORTE = '24/07/2026';

// FONTE VIVA dos dados: pasta dados/ do repositório de indicadores por cliente,
// publicada no GitHub Pages. O painel lê daqui quando está publicado/online, então
// basta atualizar os dados NAQUELE repo (rotina mensal) que este painel reflete sozinho.
// Se estiver vazio, o painel usa só os dados embutidos (window.DADOS_EMBED).
const FONTE_REMOTA = 'https://controladoriass.github.io/dashboard-juridico/dados/';

// Grupos cujo TOTAL de horas é estimativa (endpoint de timesheet degradou nos grupos grandes).
// Fonte: ESTADO_FINAL_24-07.md — os demais têm horas reais. Revisar na atualização mensal
// se a coleta real desses passar a ser viável.
const HORAS_ESTIMATIVA = new Set(['abc','russi','wf']);

// normaliza um JSON de grupo (formato do dashboard de clientes) para o modelo do painel
function processarGrupo(cod, d){
  const pano = ((d.empresas||{})._panorama||{}).dataset || {};
  const es = pano.esforco || {};
  const at = es.atividades || {};
  const h = pano.horas || {};
  const kg = d.kpiGrupo || {};
  const prazos = at['Prazos']||0, aud = at['Audiências']||0, reun = at['Reuniões e Diligências']||0;

  // séries anuais (bloco A e F)
  const entradasAno = pano.entradas || {};
  const encerradosAno = pano.encerrados || {};
  const estoqueAno = pano.estoque || {};
  const horasAno = h.horasano || {};
  const prazAno = es.prazano || {};
  const audAno = es.audano || {};
  const extraAno = es.extrajudano || {};
  const extraTipo = es.extrajudtipo || {};

  // polo (bloco C)
  const polo = pano.polo || {};
  const polAtivo = polo['Polo ativo']||0;
  const polPassivo = polo['Polo passivo']||0;
  const polTerc = polo['Terceiro/Outros']||0;
  const polTot = polAtivo+polPassivo+polTerc;

  // saldo do último ano cheio (2025) — entradas - encerramentos daquele ano
  const anoRef = '2025';
  const entRef = entradasAno[anoRef]||0;
  const encRef = encerradosAno[anoRef]||0;

  return {
    cod,
    nome: d.nome || cod,
    nomeHtml: d.nomeHtml || d.nome || cod,
    nEmpresas: d.nEmpresas || 1,
    proc: pano.total||0,
    ativos: pano.ativos||0,
    encerrados: (pano.encerradosTotal!=null?pano.encerradosTotal:(pano.total||0)-(pano.ativos||0)),
    horas: Math.round(h.total||0),
    horasEst: HORAS_ESTIMATIVA.has(cod),
    horasMediaAtivos: h.mediaAtivos||0,
    prazos, aud, reun,
    mov: prazos+aud+reun,
    area: pano.area||{},
    uf: pano.uf||{},
    tribunais: pano.tribunais||{},
    instancia: pano.instancia||{},
    // tempo médio de tramitação (bloco B)
    tramitDias: es.tramitacaoDias||0,
    comProducao: es.comProducao||0,
    // polo (bloco C)
    polAtivo, polPassivo, polTerc, polTot,
    pctAtivo: polTot ? polAtivo/polTot*100 : 0,
    pctPassivo: polTot ? polPassivo/polTot*100 : 0,
    // partes contrárias (bloco D)
    ranking: pano.ranking||[],
    // séries anuais (blocos A e F)
    entradasAno, encerradosAno, estoqueAno, horasAno, prazAno, audAno, extraAno, extraTipo,
    // saldo do último ano cheio
    saldoAno: entRef - encRef,
    entRef, encRef, anoRef
  };
}

// carrega os dados de uma base HTTP (remota ou local). Retorna nº de grupos lidos.
async function carregarDeBase(base){
  const v = '?v='+Date.now();
  const manifest = await (await fetch(base+'manifest.json'+v, {cache:'no-store'})).json();
  const lidos = [];
  for(const cod of manifest.ordem){
    try{
      const d = await (await fetch(base+cod+'.json'+v, {cache:'no-store'})).json();
      lidos.push(processarGrupo(cod, d));
    }catch(e){ console.warn('Falhou grupo',cod,e); }
  }
  if(!lidos.length) throw new Error('manifest ok mas nenhum grupo carregado');
  GRUPOS = lidos;
  return lidos.length;
}

// usa os dados embutidos no próprio HTML (funciona offline / por duplo-clique file://)
function carregarDoEmbed(){
  const emb = window.DADOS_EMBED;
  if(!emb || !emb.grupos) return 0;
  const cods = (emb.manifest && emb.manifest.ordem) || Object.keys(emb.grupos);
  GRUPOS = [];
  for(const cod of cods){
    try{ GRUPOS.push(processarGrupo(cod, emb.grupos[cod])); }
    catch(e){ console.warn('Falhou grupo (embed)',cod,e); }
  }
  return GRUPOS.length;
}

function abrirCortina(){
  const cur = document.getElementById('curtain');
  if(!cur) return;
  // Espera institucional de 2s para dar tempo da diretoria ver a marca, o brilho dourado
  // atravessar a logo e a caption estabilizar.
  setTimeout(()=>{
    cur.classList.add('open');
    document.body.classList.remove('loading');
    setTimeout(()=>cur.classList.add('done'), 1400);
  }, 2000);
}
function inicializarCurtainLogo(){
  const heroLogo = document.querySelector('.hero-logo');
  const cLogo = document.getElementById('curtain-logo');
  if(heroLogo && cLogo && heroLogo.src) cLogo.src = heroLogo.src;
}

// Estratégia "embed first, remoto no fundo":
// 1) Mostra IMEDIATAMENTE o embed (dados congelados na última atualização mensal). Zero espera visível.
// 2) Em paralelo (silenciosamente), busca a fonte remota. Se vier diferente do embed, re-renderiza.
async function carregar(){
  inicializarCurtainLogo();
  document.getElementById('m-corte').textContent = DATA_CORTE;

  // 1) Abre com o embed instantâneo
  if(carregarDoEmbed()){
    render();
    abrirCortina();
    // 2) Em background: atualiza se o remoto tiver dado mais novo (ignora silenciosamente se falhar)
    atualizarEmBackground();
    return;
  }

  // Fallback: se o embed estiver vazio, tenta remoto ou dados/ local
  const tentativas = [];
  if(FONTE_REMOTA) tentativas.push(()=>carregarDeBase(FONTE_REMOTA));
  if(location.protocol !== 'file:') tentativas.push(()=>carregarDeBase('dados/'));
  for(const t of tentativas){
    try{ if(await t()){ render(); abrirCortina(); return; } }
    catch(e){ console.warn('Fonte indisponível, tentando próxima…', e.message); }
  }
  document.getElementById('kpirow').innerHTML =
    '<div style="grid-column:1/-1;padding:24px;color:var(--muted);font-weight:600">Não foi possível carregar os dados.</div>';
  abrirCortina();
}

// Atualiza os dados no fundo. Se vier algo diferente do embed, re-renderiza com fade suave.
async function atualizarEmBackground(){
  if(!FONTE_REMOTA) return;
  // Espera 800ms antes de começar, para não competir com o render inicial (que faz várias animações).
  await new Promise(r=>setTimeout(r, 800));
  try{
    // Baixa todos os JSONs EM PARALELO (muito mais rápido que sequencial).
    const v = '?v='+Date.now();
    const manifest = await (await fetch(FONTE_REMOTA+'manifest.json'+v, {cache:'no-store'})).json();
    const promessas = manifest.ordem.map(cod =>
      fetch(FONTE_REMOTA+cod+'.json'+v, {cache:'no-store'})
        .then(r=>r.json())
        .then(d=>processarGrupo(cod, d))
        .catch(()=>null)
    );
    const lidos = (await Promise.all(promessas)).filter(Boolean);
    if(!lidos.length) return;

    // Compara com o que já está: se o total ou distribuição mudou, re-renderiza.
    const antesHash = GRUPOS.map(g=>`${g.cod}:${g.proc}:${g.ativos}:${g.horas}`).join('|');
    const depoisHash = lidos.map(g=>`${g.cod}:${g.proc}:${g.ativos}:${g.horas}`).join('|');
    if(antesHash === depoisHash) return; // idêntico ao embed — nada a fazer.

    GRUPOS = lidos;
    // Sinaliza no console para debug, e re-renderiza com transição suave.
    console.info(`✓ Dados atualizados em background: ${lidos.length} grupos (fonte remota).`);
    document.body.classList.add('reloading');
    setTimeout(()=>{
      render();
      // Aguarda o render terminar antes de tirar a classe reloading
      setTimeout(()=>document.body.classList.remove('reloading'), 400);
    }, 200);
  }catch(e){
    // Silencioso: falha em background não incomoda o usuário. Ele já está vendo o embed.
    console.info('Atualização em background falhou (usando embed).', e.message);
  }
}

/* ====================== Render ====================== */
function render(){
  renderKPIs();
  renderRankingsExec();
  renderRanking();
  renderArea();
  renderEficienciaMatriz();
  renderForo();
  renderTempo();
  renderPolo();
  renderPartes();
  renderSeries();
  renderPano();
  document.getElementById('m-grupos').textContent = GRUPOS.length;
  ativarReveal();
  ativarNav();
  ativarFiltroRank();
  ativarFiltroArea();
  ativarFiltroEff();
  ativarFiltroTempo();
  ativarFiltroPolo();
  ativarFiltroPartes();
  ativarPano();
  ativarTema();
  ativarParallax();
  marcarKpiDestaques();
  ativarBackTop();
}

/* --- Bloco H: Rankings executivos (carrossel 3 cards, meio em destaque) --- */
// Movimentação é a primeira métrica (começa no centro).
const RANKINGS_EXEC = [
  { eyebrow:'Movimentação', title:'Maior movimentação processual',
    key:'mov',
    fmt:g=>NUM(g.mov),
    sub:g=>`${NUM(g.prazos)} prazos · ${NUM(g.aud)} audiências`,
    dir:-1 },
  { eyebrow:'Volume', title:'Maior carteira ativa',
    key:'ativos',
    fmt:g=>NUM(g.ativos),
    sub:g=>`de ${NUM(g.proc)} totais`,
    dir:-1 },
  { eyebrow:'Horas', title:'Maior consumo de horas',
    key:'horas',
    fmt:g=>(g.horasEst?'~':'')+NUM(g.horas),
    sub:g=>g.horasMediaAtivos?`média ${g.horasMediaAtivos.toFixed(1)}h/ativo`:'',
    dir:-1 },
  { eyebrow:'Tempo', title:'Processos mais lentos',
    key:'tramitDias',
    fmt:g=>NUM(Math.round(g.tramitDias))+'<small>dias</small>',
    sub:g=>`≈ ${(g.tramitDias/365).toFixed(1)} anos`,
    dir:-1, filtro:g=>g.tramitDias>0 },
  { eyebrow:'Fluxo', title:'Maior crescimento em 2025',
    key:'saldoAno',
    fmt:g=>(g.saldoAno>0?'+':'')+NUM(g.saldoAno),
    sub:g=>`${NUM(g.entRef)} entr. · ${NUM(g.encRef)} enc.`,
    dir:-1, filtro:g=>g.entRef>0||g.encRef>0 }
];

let execIdx = 0;

function renderRankingsExec(){
  const track = document.getElementById('exec-track');
  const N = RANKINGS_EXEC.length;

  // gera o HTML de um card a partir do índice do RANKINGS_EXEC (com marca de clone opcional)
  function cardHTML(r, clone){
    const base = r.filtro ? GRUPOS.filter(r.filtro) : GRUPOS;
    const rows = [...base].sort((a,b)=>r.dir*((a[r.key]||0)-(b[r.key]||0))).slice(0,10);
    const lis = rows.map((g,i)=>`
      <div class="exec-row${i===0?' top1':''}" data-tt="<b>${g.nome}</b><br>${r.eyebrow}: ${r.fmt(g)}">
        <div class="rk">${i+1}</div>
        <div class="nm" title="${g.nome}">${g.nome.replace(/^Grupo\s+/,'')}</div>
        <div class="vl">${r.fmt(g)}${r.sub(g)?`<small>${r.sub(g)}</small>`:''}</div>
      </div>`).join('');
    return `<div class="exec-card${clone?' clone':''}">
      <div class="ec-eyebrow">${r.eyebrow}</div>
      <div class="ec-title">${r.title}</div>
      <div class="ec-list">${lis}</div>
    </div>`;
  }

  // Duplica: [último-1, último, ...todos, primeiro, primeiro+1]
  // Isso garante que sempre há card à esquerda e à direita, mesmo no início e fim.
  const seq = [
    RANKINGS_EXEC[N-2],
    RANKINGS_EXEC[N-1],
    ...RANKINGS_EXEC,
    RANKINGS_EXEC[0],
    RANKINGS_EXEC[1]
  ];
  // Índice lógico real (0..N-1) começa em 0 (movimentação), mas na sequência clonada é 0+2=2.
  const OFFSET = 2;
  track.innerHTML = seq.map((r,i)=>cardHTML(r, i<OFFSET || i>=OFFSET+N)).join('');

  const cards = track.querySelectorAll('.exec-card');
  const prev = document.getElementById('exec-prev');
  const next = document.getElementById('exec-next');

  let pos = OFFSET + execIdx; // posição na sequência clonada
  let saltando = false;

  function step(){
    const cardW = cards[0].getBoundingClientRect().width;
    const gap = 36;
    return cardW + gap;
  }

  function posicionar(animar=true){
    if(!cards.length) return;
    track.style.transition = animar ? '' : 'none';
    cards.forEach((c,i)=>c.classList.toggle('on', i===pos));
    // Método iterativo simples: aplica offset atual, mede a diferença real via getBoundingClientRect,
    // corrige. É robusto para qualquer padding/margem.
    const stage = track.parentElement;
    const stageCenter = stage.getBoundingClientRect().left + stage.getBoundingClientRect().width/2;
    const currentTx = parseFloat((track.style.transform.match(/-?\d+(?:\.\d+)?/)||['0'])[0]);
    // Aplica um offset provisório para medir onde o card fica
    const cardCenter = cards[pos].getBoundingClientRect().left + cards[pos].getBoundingClientRect().width/2;
    const delta = stageCenter - cardCenter;
    const newOff = currentTx + delta;
    track.style.transform = `translateX(${newOff}px)`;
  }

  // Ao final da transição, se estamos num clone, saltamos silenciosamente para o original correspondente
  track.addEventListener('transitionend', ()=>{
    if(saltando) return;
    if(pos < OFFSET){                    // clone da esquerda -> pula para o final
      saltando = true;
      pos = pos + N;
      execIdx = pos - OFFSET;
      posicionar(false);
      requestAnimationFrame(()=>{ saltando = false; });
    } else if(pos >= OFFSET + N){        // clone da direita -> pula para o começo
      saltando = true;
      pos = pos - N;
      execIdx = pos - OFFSET;
      posicionar(false);
      requestAnimationFrame(()=>{ saltando = false; });
    }
  });

  prev.onclick = ()=>{ pos--; execIdx = ((execIdx-1)%N + N)%N; posicionar(); };
  next.onclick = ()=>{ pos++; execIdx = (execIdx+1)%N; posicionar(); };

  // teclado quando a seção está no viewport
  document.addEventListener('keydown', e=>{
    const sec = document.getElementById('sec-exec');
    if(!sec) return;
    const r = sec.getBoundingClientRect();
    if(r.top > innerHeight || r.bottom < 0) return;
    if(e.key==='ArrowRight'){ next.click(); }
    else if(e.key==='ArrowLeft'){ prev.click(); }
  });
  window.addEventListener('resize', ()=>posicionar(false));
  // posiciona inicialmente sem animação (várias tentativas para pegar o momento em que o card tem largura)
  setTimeout(()=>posicionar(false), 30);
  setTimeout(()=>posicionar(false), 250);
  setTimeout(()=>posicionar(false), 900);
  // reposiciona quando a seção entra no viewport (garante que width > 0)
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting) posicionar(false); });
  }, {threshold:.1});
  io.observe(document.getElementById('sec-exec'));
  attachTT();
}

/* --- Bloco G: Eficiência (horas por processo ativo) --- */
function renderEficiencia(){
  const gs = GRUPOS.filter(g=>g.ativos>0 && g.horas>0);
  const rows = [...gs].sort((a,b)=>(b.horas/b.ativos)-(a.horas/a.ativos)).slice(0,15);
  const max = Math.max(...rows.map(r=>r.horas/r.ativos),1);
  document.getElementById('ranking-eficiencia').innerHTML = `
    <div class="bars">${rows.map(g=>{
      const media = g.horas/g.ativos;
      const pct = media/max*100;
      const est = g.horasEst ? '<span class="est-mark" data-tt="Horas por estimativa">^</span>' : '';
      return `<div class="bar-row" data-tt="<b>${g.nome}</b><br>${NUM(g.horas)}h ÷ ${NUM(g.ativos)} ativos = ${media.toFixed(1)} h/proc">
        <div class="name" title="${g.nome}">${g.nome.replace(/^Grupo\s+/,'')}</div>
        <div class="bar-track"><div class="bar-fill gold" style="width:0" data-w="${pct}"></div></div>
        <div class="val">${est}${media.toFixed(1)}<small>h/proc</small><br><small>${NUM(g.horas)}h total</small></div>
      </div>`;
    }).join('')}</div>`;
  requestAnimationFrame(()=>document.querySelectorAll('#ranking-eficiencia .bar-fill').forEach(f=>f.style.width=f.dataset.w+'%'));
  attachTT();
}

/* --- Bloco E: Presença jurídica (tribunais, mapa UF, instância) --- */
// Nomes completos dos tribunais (para tooltip)
const TRIB_NOMES = {
  'TJSC':'Tribunal de Justiça de Santa Catarina',
  'TJSP':'Tribunal de Justiça de São Paulo',
  'TJPR':'Tribunal de Justiça do Paraná',
  'TJRS':'Tribunal de Justiça do Rio Grande do Sul',
  'TJRJ':'Tribunal de Justiça do Rio de Janeiro',
  'TJMG':'Tribunal de Justiça de Minas Gerais',
  'TJDF':'Tribunal de Justiça do Distrito Federal e Territórios',
  'TJDFT':'Tribunal de Justiça do Distrito Federal e Territórios',
  'TJBA':'Tribunal de Justiça da Bahia',
  'TJPE':'Tribunal de Justiça de Pernambuco',
  'TJPA':'Tribunal de Justiça do Pará',
  'TJCE':'Tribunal de Justiça do Ceará',
  'TJGO':'Tribunal de Justiça de Goiás',
  'TJMS':'Tribunal de Justiça de Mato Grosso do Sul',
  'TJMT':'Tribunal de Justiça de Mato Grosso',
  'TJES':'Tribunal de Justiça do Espírito Santo',
  'TJAL':'Tribunal de Justiça de Alagoas',
  'TJMA':'Tribunal de Justiça do Maranhão',
  'TJPB':'Tribunal de Justiça da Paraíba',
  'TJRN':'Tribunal de Justiça do Rio Grande do Norte',
  'TJPI':'Tribunal de Justiça do Piauí',
  'TJSE':'Tribunal de Justiça de Sergipe',
  'TJTO':'Tribunal de Justiça do Tocantins',
  'TJRO':'Tribunal de Justiça de Rondônia',
  'TJAC':'Tribunal de Justiça do Acre',
  'TJAM':'Tribunal de Justiça do Amazonas',
  'TJRR':'Tribunal de Justiça de Roraima',
  'TJAP':'Tribunal de Justiça do Amapá',
  'TRT1':'Tribunal Regional do Trabalho da 1ª Região (RJ)',
  'TRT2':'Tribunal Regional do Trabalho da 2ª Região (SP)',
  'TRT3':'Tribunal Regional do Trabalho da 3ª Região (MG)',
  'TRT4':'Tribunal Regional do Trabalho da 4ª Região (RS)',
  'TRT5':'Tribunal Regional do Trabalho da 5ª Região (BA)',
  'TRT6':'Tribunal Regional do Trabalho da 6ª Região (PE)',
  'TRT7':'Tribunal Regional do Trabalho da 7ª Região (CE)',
  'TRT8':'Tribunal Regional do Trabalho da 8ª Região (PA/AP)',
  'TRT9':'Tribunal Regional do Trabalho da 9ª Região (PR)',
  'TRT10':'Tribunal Regional do Trabalho da 10ª Região (DF/TO)',
  'TRT11':'Tribunal Regional do Trabalho da 11ª Região (AM/RR)',
  'TRT12':'Tribunal Regional do Trabalho da 12ª Região (SC)',
  'TRT13':'Tribunal Regional do Trabalho da 13ª Região (PB)',
  'TRT14':'Tribunal Regional do Trabalho da 14ª Região (RO/AC)',
  'TRT15':'Tribunal Regional do Trabalho da 15ª Região (Campinas/SP)',
  'TRT16':'Tribunal Regional do Trabalho da 16ª Região (MA)',
  'TRT17':'Tribunal Regional do Trabalho da 17ª Região (ES)',
  'TRT18':'Tribunal Regional do Trabalho da 18ª Região (GO)',
  'TRT19':'Tribunal Regional do Trabalho da 19ª Região (AL)',
  'TRT20':'Tribunal Regional do Trabalho da 20ª Região (SE)',
  'TRT21':'Tribunal Regional do Trabalho da 21ª Região (RN)',
  'TRT22':'Tribunal Regional do Trabalho da 22ª Região (PI)',
  'TRT23':'Tribunal Regional do Trabalho da 23ª Região (MT)',
  'TRT24':'Tribunal Regional do Trabalho da 24ª Região (MS)',
  'TRF1':'Tribunal Regional Federal da 1ª Região',
  'TRF2':'Tribunal Regional Federal da 2ª Região',
  'TRF3':'Tribunal Regional Federal da 3ª Região',
  'TRF4':'Tribunal Regional Federal da 4ª Região',
  'TRF5':'Tribunal Regional Federal da 5ª Região',
  'TRF6':'Tribunal Regional Federal da 6ª Região',
  'STF':'Supremo Tribunal Federal',
  'STJ':'Superior Tribunal de Justiça',
  'TST':'Tribunal Superior do Trabalho',
  'TSE':'Tribunal Superior Eleitoral',
  'STM':'Superior Tribunal Militar',
  'CNJ':'Conselho Nacional de Justiça',
  'CARF':'Conselho Administrativo de Recursos Fiscais',
  'N/I':'Não informado'
};
function _nomeTrib(sigla){ return TRIB_NOMES[sigla] || sigla; }

// Normaliza rótulos de instância (JSONs têm 6 grafias diferentes)
function _normInstancia(k){
  if(!k) return 'Não informado';
  const s = String(k).toLowerCase().replace(/[º°ºo]/g,'').replace(/\s+/g,' ').trim();
  if(s.startsWith('1 grau') || s === '1grau') return '1º Grau';
  if(s.startsWith('2 grau') || s === '2grau') return '2º Grau';
  if(s.startsWith('super')) return 'Superiores';
  if(s.startsWith('nao inform') || s.includes('n/i')) return 'Não informado';
  return k;
}

let foroTribFiltro = null; // sigla do tribunal selecionado ou null

function renderForo(){
  const trib={}, uf={}, inst={};

  // agrega considerando o filtro
  GRUPOS.forEach(g=>{
    if(foroTribFiltro){
      const qt = g.tribunais[foroTribFiltro]||0;
      if(!qt) return;
      // grupo participa; escala UF/instância pela fração do tribunal na carteira
      const totalG = Object.values(g.tribunais).reduce((s,v)=>s+v,0)||1;
      const escala = qt/totalG;
      trib[foroTribFiltro] = (trib[foroTribFiltro]||0) + qt;
      Object.entries(g.uf).forEach(([k,v])=>{ if(k && k!=='N/I') uf[k]=(uf[k]||0)+Math.round(v*escala); });
      Object.entries(g.instancia).forEach(([k,v])=>{ const n=_normInstancia(k); inst[n]=(inst[n]||0)+Math.round(v*escala); });
    } else {
      Object.entries(g.tribunais).forEach(([k,v])=>trib[k]=(trib[k]||0)+v);
      Object.entries(g.uf).forEach(([k,v])=>{ if(k && k!=='N/I') uf[k]=(uf[k]||0)+v; });
      Object.entries(g.instancia).forEach(([k,v])=>{ const n=_normInstancia(k); inst[n]=(inst[n]||0)+v; });
    }
  });

  _renderConcentracao(trib, uf, inst);
  _renderTribBars(trib);
  _renderMapa(uf);
  _renderInstancia(inst);
  _atualizarFiltroTag();
  attachTT();
}

function _atualizarFiltroTag(){
  const tag = document.getElementById('foro-trib-filtro-label');
  if(foroTribFiltro){
    tag.classList.add('on');
    tag.textContent = `filtro: ${foroTribFiltro} `;
    tag.onclick = ()=>{ foroTribFiltro = null; renderForo(); };
  } else {
    tag.classList.remove('on');
    tag.textContent = '';
    tag.onclick = null;
  }
}

// A) Card Concentração regional
function _renderConcentracao(trib, uf, inst){
  const totTrib = Object.values(trib).reduce((s,v)=>s+v,0)||1;
  const ufOrd = Object.entries(uf).sort((a,b)=>b[1]-a[1]);
  const totUf = ufOrd.reduce((s,[,v])=>s+v,0)||1;
  const tribOrd = Object.entries(trib).sort((a,b)=>b[1]-a[1]);
  const [tribTop, qtdTop] = tribOrd[0] || ['sem registro', 0];
  const pctTop = qtdTop/totTrib*100;
  document.getElementById('foro-conc-head').innerHTML =
    `${pctTop.toFixed(1)}<span style="font-size:22px;font-weight:700;color:var(--gold-soft);margin-left:2px">%</span>
     <span class="fc-lbl">${tribTop}</span>`;
  const nUf = ufOrd.length;
  const [ufTop, ufQtd] = ufOrd[0] || ['sem registro', 0];
  document.getElementById('foro-conc-sub').innerHTML =
    `<b style="color:#fff">${NUM(qtdTop)}</b> processos no tribunal dominante · atuamos em <b style="color:#fff">${nUf} UFs</b>, com <b style="color:#fff">${ufTop}</b> concentrando ${(ufQtd/totUf*100).toFixed(1)}%.`;
  // top 4 UFs seguintes + agregado
  const proximas = ufOrd.slice(0,4);
  const outras = ufOrd.slice(4);
  const qtdOutras = outras.reduce((s,[,q])=>s+q,0);
  const proximasHTML = proximas.map(([u,q])=>`
    <div class="fc-item"><span class="lbl">${u}</span><span class="val">${NUM(q)} · ${(q/totUf*100).toFixed(1)}%</span></div>`).join('');
  const outrasHTML = outras.length>0 ? `
    <div class="fc-item" style="border-top:1px dashed rgba(255,255,255,.15);padding-top:8px;margin-top:2px">
      <span class="lbl" style="font-style:italic">+ ${outras.length} outras UFs</span>
      <span class="val">${NUM(qtdOutras)} · ${(qtdOutras/totUf*100).toFixed(1)}%</span>
    </div>` : '';
  document.getElementById('foro-conc-list').innerHTML = proximasHTML + outrasHTML;
}

// B) Ranking de tribunais (barras animadas + count-up + top 3 destaque)
function _renderTribBars(trib){
  const ord = Object.entries(trib).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const total = Object.values(trib).reduce((s,v)=>s+v,0)||1;
  const max = ord[0] ? ord[0][1] : 1;
  const container = document.getElementById('foro-trib-bars');
  container.innerHTML = ord.map(([t,q],i)=>{
    const pct = q/max*100;
    const pctTot = (q/total*100).toFixed(1);
    const podium = i===0?' top1':i===1?' top2':i===2?' top3':'';
    const gs = [...GRUPOS].filter(g=>g.tribunais[t]).sort((a,b)=>b.tribunais[t]-a.tribunais[t]).slice(0,3).map(g=>g.nome.replace(/^Grupo\s+/,'')).join(', ');
    const isFiltro = t===foroTribFiltro;
    const nomeCompleto = _nomeTrib(t);
    return `<div class="bar-row${podium}${isFiltro?' top1':''}" style="animation-delay:${Math.min(i*35,600)}ms;cursor:pointer" data-trib="${t}" data-tt="<b>${t}</b> · ${nomeCompleto}<br>${NUM(q)} processos · ${pctTot}% do total<br>Top grupos: ${gs}">
      <div class="name" title="${nomeCompleto}"><span class="rk-badge">${i+1}</span>${t}</div>
      <div class="bar-track"><div class="bar-fill gold" style="width:0" data-w="${pct}" data-v="${q}"></div></div>
      <div class="val"><span class="v-num" data-final="${q}">0</span><small>${pctTot}%</small></div>
    </div>`;
  }).join('');
  // anima + count-up
  setTimeout(()=>{
    container.querySelectorAll('.bar-row').forEach((row,i)=>{
      const fill = row.querySelector('.bar-fill'), vNum = row.querySelector('.v-num');
      if(!fill||!vNum) return;
      const alvo = +fill.dataset.v;
      setTimeout(()=>{
        fill.style.width = fill.dataset.w+'%';
        fill.classList.add('go');
        const dur=850, passos=28; let k=0;
        const iv = setInterval(()=>{
          k++;
          const p=k/passos, e=1-Math.pow(1-p,5);
          if(k<passos) vNum.textContent = NUM(Math.round(alvo*e));
          else { vNum.textContent = NUM(alvo); clearInterval(iv); }
        }, dur/passos);
      }, Math.min(i*35,600)+40);
    });
    // clique alterna filtro
    container.querySelectorAll('.bar-row').forEach(row=>{
      row.onclick = ()=>{
        const t = row.dataset.trib;
        foroTribFiltro = (foroTribFiltro===t) ? null : t;
        renderForo();
      };
    });
  }, 30);
}

// C) Mapa do Brasil por UF (heatmap)
// SVG dos estados (paths simplificados, viewBox 0 0 1000 1000)
const BR_MAPA = {"viewBox":"0 0 1000 912","ufs":{"RS":"M451.8 716.4 468.4 714.6 468.9 717.8 485.3 718.8 491.0 724.4 502.0 726.9 516.6 744.0 535.2 749.1 525.8 762.9 528.0 766.5 530.1 762.8 534.9 765.8 517.1 802.1 487.3 832.5 487.1 824.4 492.2 825.0 504.1 815.8 505.9 806.4 509.5 807.9 509.5 802.2 515.2 798.4 514.5 789.9 517.8 792.0 516.8 785.8 510.7 791.7 503.3 781.7 502.4 786.7 507.2 789.7 503.6 799.7 501.4 796.5 500.1 806.8 489.6 812.7 488.7 820.1 487.2 818.0 484.5 822.3 483.7 829.8 487.2 829.2 487.0 832.4 475.9 855.7 460.5 870.3 457.9 856.5 466.5 845.7 457.4 839.2 453.5 829.8 436.4 815.7 423.5 810.6 416.5 801.3 408.1 806.8 408.1 800.1 391.6 783.9 383.3 788.3 375.9 785.7 410.2 744.1 414.5 744.6 412.9 740.7 427.9 732.0 432.4 724.7 451.8 716.4Z","RR":"M348.5 121.2 350.5 143.1 326.8 143.4 320.1 156.6 321.3 161.7 312.9 164.8 303.3 157.6 296.8 162.5 295.5 176.2 290.3 175.6 277.4 163.6 281.4 159.9 275.7 147.9 278.5 131.1 271.6 115.4 273.3 108.4 260.6 103.7 259.6 98.9 246.2 97.9 243.3 75.7 231.0 61.5 244.3 64.9 247.3 69.8 259.8 67.7 269.9 76.1 272.5 66.4 296.5 62.0 314.8 49.7 313.0 42.7 325.1 41.9 328.1 45.7 324.5 56.4 334.1 59.3 337.3 68.3 330.5 75.5 329.5 99.7 334.2 112.3 348.5 121.2Z","PA":"M433.0 98.2 433.8 112.0 441.4 112.2 460.1 122.5 478.5 165.4 483.4 170.5 490.7 170.9 489.0 175.8 474.6 179.9 483.3 178.2 484.8 181.7 512.2 166.0 509.9 170.4 516.0 182.7 512.2 187.1 516.9 184.2 520.8 189.4 529.6 184.4 532.9 190.1 532.2 186.0 537.4 188.2 540.8 183.5 535.9 201.6 550.0 179.9 548.6 184.9 556.2 175.5 560.8 181.1 562.9 177.3 559.4 177.1 559.7 173.5 562.7 174.1 566.3 163.4 573.3 159.0 574.7 162.9 577.8 159.3 581.7 164.0 580.9 159.3 586.8 163.8 587.8 161.0 588.4 165.1 590.2 161.7 590.6 165.8 593.2 162.0 594.6 166.7 597.7 165.1 594.6 168.2 601.1 165.2 600.1 168.7 604.7 169.7 605.7 165.9 604.4 171.5 608.3 170.4 604.1 190.8 588.0 225.8 577.9 239.3 554.5 255.5 566.2 260.5 564.8 267.4 556.0 281.9 544.9 287.5 541.4 300.1 546.0 305.3 543.2 316.8 528.1 336.2 524.4 346.9 392.8 337.8 376.3 324.5 375.2 313.7 359.3 286.7 402.0 192.7 394.3 192.1 374.8 179.6 353.2 160.8 348.5 121.2 357.4 122.2 361.6 115.4 367.5 117.1 386.1 106.9 409.3 110.3 405.4 102.2 408.9 96.7 413.9 99.4 429.3 95.1 433.0 98.2ZM560.1 159.3 556.5 169.5 550.9 170.7 552.7 176.2 549.5 173.7 552.5 176.9 545.3 175.6 544.8 180.3 538.6 177.8 535.8 183.4 534.3 179.5 533.7 184.1 528.6 181.0 526.0 183.5 524.0 177.6 521.6 184.6 513.0 176.6 513.2 169.5 517.9 171.5 519.6 168.6 513.2 168.2 514.3 158.8 518.1 161.3 515.1 154.9 521.7 149.8 560.8 152.9 560.1 159.3ZM505.3 160.0 503.6 168.2 490.3 177.3 498.3 160.4 505.3 160.0ZM528.4 141.6 538.6 140.5 531.8 147.9 522.2 146.7 521.5 143.5 528.4 141.6ZM521.5 142.7 518.7 143.5 521.8 135.2 521.5 142.7ZM509.5 153.5 510.1 147.9 516.0 148.1 509.5 153.5ZM532.5 149.7 539.3 145.9 542.3 147.9 532.5 149.7ZM516.4 146.2 518.8 144.3 520.3 147.7 516.4 146.2Z","AC":"M49.7 291.4 118.9 312.5 193.9 348.4 154.3 372.9 138.5 369.2 113.5 370.8 115.8 338.5 100.2 349.9 82.2 350.2 79.8 340.5 61.6 338.0 66.6 329.7 45.6 300.4 46.2 296.2 51.6 295.2 49.7 291.4Z","AP":"M433.0 98.2 445.9 105.2 453.3 99.9 470.3 103.5 497.2 62.3 500.2 68.5 498.6 58.1 505.3 65.5 505.5 74.1 507.4 69.4 513.5 106.0 530.2 113.0 531.5 121.3 526.1 123.1 531.4 124.2 513.2 144.3 502.4 149.3 494.6 168.4 487.4 172.2 478.5 165.4 476.2 155.5 470.4 151.5 460.1 122.5 441.4 112.2 433.8 112.0 433.0 98.2Z","MS":"M373.6 510.7 378.7 515.2 393.1 501.9 405.9 499.1 424.8 509.6 436.4 505.8 445.7 508.4 454.9 500.4 449.1 514.9 467.7 516.6 468.1 523.9 473.4 525.0 470.8 530.4 479.2 531.3 509.8 547.6 508.4 562.9 497.3 571.7 488.0 594.8 479.6 606.0 457.0 621.7 444.5 646.5 435.7 641.5 420.4 645.3 415.9 615.9 411.1 608.3 399.8 603.6 391.1 608.4 368.3 603.6 371.8 579.8 364.8 562.4 370.9 558.5 365.5 553.1 378.8 521.4 373.6 510.7Z","PR":"M443.7 646.9 457.0 621.7 469.8 614.4 487.5 613.4 513.8 622.8 529.4 621.6 536.4 629.5 537.3 643.2 544.8 653.4 543.3 660.5 557.6 660.8 557.9 669.1 564.8 668.2 568.8 673.0 565.2 678.1 566.9 674.1 562.7 675.9 562.9 673.0 559.9 678.5 554.5 675.8 562.2 680.6 558.5 686.8 553.9 687.3 557.7 689.8 546.8 690.1 539.0 695.4 530.1 690.5 517.2 690.4 514.3 695.5 504.7 697.2 500.6 706.1 455.4 696.1 450.4 681.9 446.3 678.9 439.6 683.3 436.5 680.7 443.7 646.9Z","SC":"M534.9 765.8 530.1 762.8 525.8 765.0 534.1 746.3 516.6 744.0 502.0 726.9 483.4 718.2 468.9 717.8 468.4 714.6 451.8 716.5 455.4 696.1 500.6 706.1 504.7 697.2 514.3 695.5 517.2 690.4 530.1 690.5 539.0 695.4 546.8 690.1 557.7 689.8 556.0 695.5 553.4 691.8 559.8 716.2 556.9 718.3 556.6 740.7 554.1 746.6 551.8 743.3 553.2 749.2 534.9 765.8ZM558.5 697.9 555.3 697.1 558.7 694.0 558.5 697.9Z","AM":"M259.6 102.6 273.6 109.1 271.6 115.4 278.5 131.1 275.7 147.9 281.4 159.9 277.4 163.6 290.3 175.6 295.5 176.2 296.8 162.5 303.3 157.6 312.9 164.8 321.3 161.7 320.1 156.6 326.8 143.4 350.5 143.1 350.9 155.0 360.2 168.8 393.2 191.5 402.0 192.7 358.7 282.9 365.3 295.9 358.4 323.6 293.2 323.3 289.1 327.1 272.7 310.4 256.5 309.3 247.4 318.0 244.8 328.8 231.5 329.4 225.7 338.4 222.8 334.8 211.9 341.3 199.1 337.8 190.2 346.8 118.9 312.5 49.7 291.4 52.4 284.9 63.0 278.4 61.2 270.3 67.6 251.2 88.0 238.8 106.9 236.1 110.6 231.4 126.9 234.2 138.5 171.5 134.0 158.2 125.0 150.9 125.3 135.8 143.8 134.6 139.7 126.2 129.4 126.3 129.3 113.3 163.4 113.0 162.8 107.1 168.1 112.6 178.2 104.6 184.4 113.2 185.1 124.0 189.3 123.0 201.2 132.6 215.1 127.9 216.6 134.6 224.3 125.0 239.0 117.3 240.1 120.2 246.5 108.8 259.6 102.6Z","RO":"M193.9 348.4 190.2 346.8 198.9 337.9 211.9 341.3 222.8 334.8 225.5 338.5 231.5 329.4 244.8 328.8 247.4 318.0 256.5 309.3 270.8 309.6 285.0 325.2 289.4 327.1 293.5 323.3 297.8 327.3 297.4 370.3 327.9 373.8 329.6 378.5 325.7 385.9 331.3 399.1 329.6 403.9 313.2 425.5 306.7 421.4 290.8 422.9 285.1 414.8 271.6 411.8 265.8 404.6 241.4 401.4 226.9 390.8 219.2 375.8 219.1 343.7 193.9 348.4Z","MT":"M365.3 295.9 375.2 313.7 376.3 324.5 392.8 337.8 524.4 346.9 514.2 380.2 515.6 404.0 519.5 409.2 511.7 426.6 509.3 444.3 505.5 452.8 495.9 457.2 491.5 469.8 478.3 477.2 474.5 487.8 468.3 492.4 463.8 507.0 467.7 516.6 449.1 514.9 454.9 500.4 445.7 508.4 436.4 505.8 424.8 509.6 406.3 499.1 393.1 501.9 378.7 515.2 371.8 506.1 360.0 500.2 361.0 480.0 324.5 479.7 322.8 463.2 316.0 455.3 322.3 455.0 320.0 432.1 313.2 425.5 319.8 420.7 331.3 399.5 325.7 385.9 329.6 378.5 327.7 373.5 318.9 370.6 297.1 369.9 295.3 324.9 357.1 324.5 365.3 295.9Z","MA":"M554.9 255.7 577.9 239.3 588.0 225.8 610.1 168.9 613.5 174.4 615.3 170.5 616.2 175.2 621.5 173.6 620.6 178.8 623.6 174.4 623.0 182.7 632.5 176.3 633.7 184.2 639.4 184.7 640.0 188.9 633.4 193.6 636.8 196.6 640.7 190.9 642.7 194.7 636.8 199.9 639.1 198.8 634.0 214.2 641.3 207.1 642.9 198.6 648.5 196.0 643.3 204.6 655.5 197.6 661.0 199.1 661.9 194.7 685.4 204.8 693.9 202.7 691.3 211.7 680.1 217.3 670.3 233.1 674.1 252.1 668.0 267.2 673.1 273.9 671.8 282.3 661.8 285.8 650.5 283.7 636.0 296.9 620.3 302.7 610.1 328.2 613.8 339.1 610.8 356.6 602.7 353.6 596.2 344.9 598.9 340.2 587.9 330.4 592.9 319.0 599.8 317.4 599.9 308.7 589.1 310.1 577.7 298.0 579.8 295.1 574.6 292.9 579.2 289.2 581.4 278.4 579.6 259.1 562.6 251.8 554.9 255.7Z","PI":"M610.8 356.6 613.8 339.1 610.1 328.2 620.3 302.7 636.0 296.9 650.5 283.7 661.8 285.8 671.6 282.6 673.6 275.9 668.6 269.8 668.1 261.1 674.1 251.7 670.3 233.1 680.1 217.3 691.3 211.7 693.4 203.4 703.5 206.5 701.4 216.9 708.9 234.9 706.7 246.8 716.0 281.7 722.2 285.2 716.5 298.7 718.8 311.7 695.6 329.3 693.2 334.9 683.8 336.0 677.8 341.2 660.9 335.8 653.5 338.5 656.1 350.5 647.1 362.5 628.5 368.4 618.2 357.2 610.8 356.6Z","CE":"M719.7 296.9 722.2 285.2 714.8 278.2 705.8 242.9 708.7 233.5 701.4 216.3 704.4 206.0 720.6 203.8 730.8 205.1 761.4 222.3 786.2 245.0 776.4 249.8 768.0 266.6 759.1 274.0 755.8 288.4 760.1 295.5 751.2 306.3 737.5 296.6 719.7 296.9Z","RN":"M760.2 276.5 776.4 249.8 786.2 245.0 800.1 251.1 821.0 251.4 832.0 278.9 803.2 274.9 796.6 288.5 794.9 284.1 780.6 282.5 786.6 269.2 775.9 272.1 768.4 279.2 760.2 276.5Z","PB":"M756.8 301.6 760.1 295.0 755.9 287.2 760.5 275.9 768.4 279.2 785.7 269.2 780.4 282.1 786.3 285.4 791.2 283.1 799.7 287.4 801.0 276.5 804.8 274.8 832.0 278.9 835.4 292.6 834.9 300.1 821.2 298.2 820.0 302.3 802.7 305.7 791.7 315.1 788.0 308.9 783.9 309.0 791.1 298.9 786.1 294.6 769.2 305.7 756.8 301.6Z","PE":"M702.9 323.8 718.8 311.7 717.3 297.1 737.5 296.6 749.1 306.3 756.8 301.6 765.9 306.2 785.8 294.5 791.1 298.9 783.9 309.0 788.0 308.9 791.7 315.1 802.7 305.7 812.5 306.1 825.4 296.8 835.2 301.6 828.3 327.9 811.2 327.4 804.1 333.8 792.2 336.9 775.7 326.8 766.1 336.4 761.1 326.3 757.8 329.2 743.0 320.1 717.6 339.6 712.6 326.6 702.9 323.8Z","AL":"M766.1 336.4 775.7 326.8 792.2 336.9 804.1 333.8 810.8 327.5 828.2 327.9 817.2 343.4 811.8 342.1 815.2 344.4 802.9 360.4 791.7 349.6 766.1 336.4Z","SE":"M770.9 340.4 791.7 349.6 802.9 360.4 788.2 373.1 785.4 371.0 788.0 374.4 777.4 382.2 771.0 378.5 765.9 367.9 775.2 362.9 770.9 340.4Z","BA":"M614.6 356.9 623.5 366.1 633.4 368.1 651.7 358.9 656.5 346.9 653.5 338.5 660.9 335.8 677.8 341.2 683.8 336.0 693.2 334.9 702.9 323.8 712.6 326.6 717.6 339.6 743.0 320.1 765.0 329.9 775.4 352.4 775.0 363.5 767.0 364.7 766.1 368.5 774.9 381.3 783.7 379.9 764.4 410.4 760.1 412.1 756.9 402.9 754.6 408.3 752.2 406.3 756.2 409.1 749.4 420.0 751.1 429.1 747.7 427.0 749.9 436.1 752.1 430.3 749.3 446.5 753.5 471.1 746.5 498.6 747.7 510.2 737.1 523.1 726.8 516.5 726.4 511.3 718.3 503.6 720.1 493.4 725.6 491.8 725.2 486.3 733.3 477.2 726.3 470.5 703.9 468.8 694.3 455.5 688.4 457.0 666.6 445.6 655.9 447.8 652.6 445.9 654.2 439.6 645.7 437.4 608.0 458.2 611.3 439.7 604.5 429.7 608.5 410.8 602.8 398.4 603.0 393.2 608.3 389.5 604.2 386.1 608.0 382.9 598.2 377.1 605.1 368.3 603.5 365.7 614.6 356.9Z","ES":"M726.4 515.8 737.1 523.1 734.8 550.4 711.1 586.3 696.1 582.8 693.2 566.3 703.0 562.9 711.8 545.2 705.6 534.3 712.1 532.8 707.6 522.3 715.1 519.4 712.2 515.2 726.4 515.8Z","RJ":"M693.0 575.6 696.1 582.8 711.1 586.3 711.1 600.9 690.9 613.7 690.0 623.4 669.5 623.3 668.6 616.5 664.7 618.3 665.7 623.7 650.2 626.0 658.0 624.0 653.0 621.5 645.2 624.9 643.0 622.0 635.9 626.2 639.9 630.3 633.5 630.3 634.0 623.5 646.7 616.7 633.2 610.9 654.3 603.2 668.8 603.7 684.0 596.3 687.4 579.6 693.0 575.6Z","SP":"M465.4 617.3 488.0 594.8 497.3 571.7 519.3 554.2 543.8 558.2 544.9 565.2 549.2 562.1 551.3 568.3 552.9 562.1 580.1 558.0 584.8 563.3 585.0 578.2 589.6 589.1 599.5 590.2 595.5 608.7 601.9 613.5 602.8 620.9 614.1 620.5 615.2 614.8 621.8 616.2 633.2 610.9 646.7 616.7 634.1 623.4 635.2 631.8 621.5 637.4 621.3 642.1 612.4 640.4 603.9 646.3 601.9 643.0 602.1 646.3 568.4 668.7 571.7 669.2 567.8 674.8 564.8 668.2 557.9 669.1 557.6 660.8 543.3 660.5 544.8 653.4 537.3 643.2 536.4 629.5 529.6 621.7 513.8 622.8 487.5 613.4 465.4 617.3ZM625.5 643.7 620.7 643.4 623.6 639.6 625.5 643.7Z","GO":"M509.8 547.6 479.2 531.3 470.8 530.4 473.4 525.0 467.7 523.2 463.8 507.0 468.3 492.4 476.1 485.3 475.4 480.3 491.2 470.1 495.9 457.2 507.0 450.9 511.7 426.6 522.1 402.3 526.5 399.7 524.3 410.4 541.3 416.9 549.2 404.6 554.3 419.7 556.3 415.2 566.1 413.1 576.1 419.1 576.2 413.9 578.9 417.9 605.0 407.5 608.5 410.9 604.5 429.7 611.3 439.7 611.5 446.8 607.8 451.9 599.4 447.2 598.7 454.1 591.8 454.2 592.9 471.3 583.5 475.0 580.4 484.6 586.5 494.8 578.9 504.8 583.9 506.9 584.0 517.5 571.1 525.9 550.3 523.2 541.7 529.7 539.0 526.8 523.2 531.1 509.8 547.6ZM583.5 475.0 581.1 463.7 565.6 463.8 564.4 474.8 583.5 475.0Z","DF":"M583.5 475.0 564.4 474.8 565.6 463.8 581.1 463.7 583.5 475.0Z","MG":"M509.1 561.1 509.8 547.6 522.6 531.4 539.0 526.8 541.7 529.7 550.3 523.2 571.1 525.9 584.0 517.5 584.1 507.4 578.9 503.9 586.5 494.1 580.4 484.5 583.5 475.0 592.9 471.3 591.7 454.5 598.7 454.1 599.4 447.2 603.7 451.4 609.2 450.5 608.4 458.4 638.7 439.6 649.9 438.1 654.2 439.6 653.5 446.9 671.1 446.6 688.4 457.0 694.3 455.5 703.9 468.8 725.8 470.3 733.3 476.5 719.0 497.7 718.3 503.6 726.4 515.8 712.2 515.2 715.1 519.4 707.5 522.6 712.1 532.8 705.6 534.3 711.6 540.6 711.3 547.5 703.0 562.9 693.2 566.3 694.1 572.8 687.4 579.6 684.6 595.8 668.8 603.7 654.3 603.2 621.8 616.2 615.2 614.8 614.1 620.5 603.1 621.0 601.9 613.5 595.5 608.7 599.5 590.2 589.6 589.1 585.0 578.2 584.8 563.3 580.1 558.0 552.9 562.1 551.3 568.3 549.2 562.1 544.9 565.2 543.4 558.1 519.3 554.2 509.1 561.1Z","TO":"M524.4 346.9 528.1 336.2 543.2 316.8 546.0 305.3 541.4 300.1 544.9 287.5 556.0 281.9 563.7 270.7 566.4 260.8 554.9 255.7 561.1 251.8 571.9 253.8 579.6 259.1 582.1 273.5 579.4 288.7 574.6 292.9 579.8 295.1 577.7 298.0 589.1 310.1 600.0 309.0 599.8 317.4 592.9 319.0 587.9 330.4 598.9 340.2 596.2 344.9 602.8 353.7 614.6 356.9 603.5 365.7 605.1 368.3 598.2 377.1 608.0 382.9 604.2 386.5 608.3 389.5 602.9 393.8 605.0 407.5 578.9 417.9 576.2 413.9 576.1 419.1 566.1 413.1 556.3 415.2 554.5 419.7 549.2 404.6 541.6 416.9 523.8 409.9 526.1 399.4 517.2 407.8 514.2 380.2 524.4 346.9Z"},"centroids":{"RS":[476.1,789.0],"RR":[296.7,105.4],"PA":[510.7,185.1],"AC":[91.8,331.0],"AP":[486.2,113.2],"MS":[428.6,557.6],"PR":[520.0,668.4],"SC":[523.5,721.3],"AM":[223.4,197.6],"RO":[263.6,363.1],"MT":[402.6,432.0],"MA":[624.5,243.0],"PI":[669.0,294.1],"CE":[737.0,258.4],"RN":[788.7,270.0],"PB":[790.6,292.4],"PE":[769.2,315.5],"AL":[798.5,338.8],"SE":[780.7,363.7],"BA":[695.5,410.3],"ES":[713.7,540.9],"RJ":[666.2,610.7],"SP":[569.6,616.8],"GO":[546.2,468.3],"DF":[575.6,470.5],"MG":[623.7,527.3],"TO":[570.8,343.6]},"nomes":{"RS":"Rio Grande do Sul","RR":"Roraima","PA":"Pará","AC":"Acre","AP":"Amapá","MS":"Mato Grosso do Sul","PR":"Paraná","SC":"Santa Catarina","AM":"Amazonas","RO":"Rondônia","MT":"Mato Grosso","MA":"Maranhão","PI":"Piauí","CE":"Ceará","RN":"Rio Grande do Norte","PB":"Paraíba","PE":"Pernambuco","AL":"Alagoas","SE":"Sergipe","BA":"Bahia","ES":"Espírito Santo","RJ":"Rio de Janeiro","SP":"São Paulo","GO":"Goiás","DF":"Distrito Federal","MG":"Minas Gerais","TO":"Tocantins"}};

function _renderMapa(uf){
  const el = document.getElementById('foro-map');
  const entries = Object.entries(uf).filter(([,v])=>v>0);
  const total = entries.reduce((s,[,v])=>s+v,0)||1;
  const maxV = Math.max(...entries.map(([,v])=>v),1);

  const rankUf = [...entries].sort((a,b)=>b[1]-a[1]);
  const topUfs = rankUf.slice(0,6);

  // gera paths reais do Brasil (BR_MAPA.ufs, BR_MAPA.centroids)
  const siglas = Object.keys(BR_MAPA.ufs).sort();
  const paths = siglas.map(sigla=>{
    const d = BR_MAPA.ufs[sigla];
    const [cx,cy] = BR_MAPA.centroids[sigla] || [0,0];
    const v = uf[sigla]||0;
    const nomeUF = BR_MAPA.nomes[sigla] || sigla;
    const topG = v ? _topGruposUf(sigla) : '';
    return `<path data-uf="${sigla}" data-v="${v}" d="${d}" data-tt="<b>${sigla} · ${nomeUF}</b><br>${NUM(v)} processos · ${(v/total*100).toFixed(1)}%${topG?`<br>${topG}`:''}"></path>
      ${v>0 ? `<text class="uf-lbl" x="${cx}" y="${cy}" text-anchor="middle" dy="3">${sigla}</text>` : ''}`;
  }).join('');

  // Escala em degraus (legenda): 0, 1-quartil, 2-quartil, 3-quartil, max
  const sortedVals = entries.map(([,v])=>v).sort((a,b)=>a-b);
  const q = pct => sortedVals[Math.floor(sortedVals.length * pct)] || 0;
  const stopsLbl = [
    {v:0, lbl:'0'},
    {v:q(.25), lbl:NUM(q(.25))},
    {v:q(.5), lbl:NUM(q(.5))},
    {v:q(.75), lbl:NUM(q(.75))},
    {v:maxV, lbl:NUM(maxV)}
  ];

  el.innerHTML = `
    <div class="foro-map-wrap">
      <svg class="foro-map-svg" viewBox="${BR_MAPA.viewBox}" preserveAspectRatio="xMidYMid meet">${paths}</svg>
      <div class="foro-map-side">
        <div class="foro-map-scale">
          <div class="foro-map-scale-title">Volume por UF</div>
          <div class="foro-map-scale-bar"></div>
          <div class="foro-map-scale-ticks">
            ${stopsLbl.map(s=>`<span>${s.lbl}</span>`).join('')}
          </div>
        </div>
        <div class="foro-map-top">
          <div class="foro-map-top-title">Top 6 estados</div>
          ${topUfs.map(([u,pQ])=>`<div class="foro-map-top-row"><div class="uf">${u}</div><div class="nm">${(pQ/total*100).toFixed(1)}% da carteira</div><div class="qt">${NUM(pQ)}</div></div>`).join('')}
        </div>
      </div>
    </div>`;

  // Cores em cascata (por ordem de volume, do maior para o menor, com atraso curto)
  const paths_el = [...el.querySelectorAll('path')];
  paths_el.sort((a,b)=>(+b.dataset.v)-(+a.dataset.v)).forEach((p,i)=>{
    const v = +p.dataset.v;
    setTimeout(()=>{
      const pct = v/maxV;
      p.style.fill = _corHeatmap(pct);
    }, i*28);
  });
}

// Escala navy → dourado forte (contraste alto).
// 0 = paper claro; 0.25 = navy claro; 0.5 = navy médio; 0.75 = dourado; 1 = gold escuro.
function _corHeatmap(pct){
  if(pct === 0){
    // Estado sem processos: cor de fundo neutra sensível ao tema
    return document.body.classList.contains('theme-dark') ? '#2B2F45' : '#e7e2d6';
  }
  // stops calibrados para contraste alto — troca conforme o tema
  const isDark = document.body.classList.contains('theme-dark');
  const stops = isDark ? [
    [43, 47, 69],     // 0.00 — navy escuro (fundo do painel)
    [91, 106, 148],   // 0.20 — navy médio
    [154, 130, 90],   // 0.45 — bronze
    [207, 163, 110],  // 0.75 — dourado suave
    [231, 199, 142]   // 1.00 — dourado brilhante
  ] : [
    [231, 226, 214],  // 0.00 — paper
    [180, 190, 210],  // 0.20 — navy muito claro
    [102, 122, 158],  // 0.45 — navy médio
    [181, 134, 66],   // 0.75 — dourado
    [70, 55, 30]      // 1.00 — bronze/marrom escuro
  ];
  // função de rampa
  const n = stops.length - 1;
  const p = Math.max(0, Math.min(1, pct));
  const idx = Math.min(Math.floor(p * n), n - 1);
  const local = p * n - idx;
  const a = stops[idx], b = stops[idx + 1];
  const rgb = a.map((v, i) => Math.round(v + (b[i] - v) * local));
  return `rgb(${rgb.join(',')})`;
}

function _topGruposUf(sigla){
  return [...GRUPOS]
    .map(g=>({n:g.nome.replace(/^Grupo\s+/,''), q:g.uf[sigla]||0}))
    .filter(x=>x.q>0)
    .sort((a,b)=>b.q-a.q).slice(0,3)
    .map(x=>`${x.n}: <b>${NUM(x.q)}</b>`).join('<br>');
}

// D) Instância como pirâmide vertical (funil executivo)
function _renderInstancia(inst){
  // Ordem hierárquica de baixo pra cima: 1º Grau (base) → 2º → Superiores (topo)
  const ordem = ['Superiores','2º Grau','1º Grau'];
  const rowsAll = ordem.map(k=>[k, inst[k]||0]);
  const naoInf = inst['Não informado']||0;
  const total = rowsAll.reduce((s,[,v])=>s+v,0) + naoInf || 1;
  const totalConhecido = rowsAll.reduce((s,[,v])=>s+v,0) || 1;
  const max = Math.max(...rowsAll.map(r=>r[1]),1);

  // Descrição de cada nível
  const desc = {
    '1º Grau':'Onde a maior parte das disputas está ativa.',
    '2º Grau':'Casos em fase de reforma ou apelação.',
    'Superiores':'STF, STJ e TST. Casos de repercussão jurisprudencial.'
  };
  const isDark = document.body.classList.contains('theme-dark');
  const cores = isDark ? {
    '1º Grau':'linear-gradient(180deg,#e4c78e 0%,#B58642 100%)',
    '2º Grau':'linear-gradient(180deg,#5b6a94 0%,#2c3357 100%)',
    'Superiores':'linear-gradient(180deg,#7a7f96 0%,#3F5276 100%)'
  } : {
    '1º Grau':'linear-gradient(180deg,#c9a54a 0%,#8a6534 100%)',
    '2º Grau':'linear-gradient(180deg,#3F5276 0%,#1E223F 100%)',
    'Superiores':'linear-gradient(180deg,#5b6a94 0%,#2c3357 100%)'
  };

  const container = document.getElementById('foro-inst-bars');
  container.innerHTML = `<div class="foro-piramide">
    ${rowsAll.map((r,i)=>{
      const [nome, q] = r;
      const pct = q/max*100;
      const pctTot = (q/totalConhecido*100).toFixed(1);
      return `<div class="pir-camada" style="animation-delay:${i*120}ms" data-tt="<b>${nome}</b><br>${NUM(q)} processos · ${pctTot}% do escritório<br><i>${desc[nome]||''}</i>">
        <div class="pir-tag">${nome}</div>
        <div class="pir-bar" style="width:0;background:${cores[nome]||'var(--navy2)'}" data-w="${Math.max(pct,3)}">
          <span class="pir-val">${NUM(q)}</span>
          <span class="pir-pct">${pctTot}%</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // Anima crescendo de dentro pra fora (efeito funil)
  setTimeout(()=>{
    container.querySelectorAll('.pir-bar').forEach((bar,i)=>{
      setTimeout(()=>{
        bar.style.width = bar.dataset.w + '%';
      }, i*140+120);
    });
  }, 30);

  // Nota: destaca a camada dominante + trata "não informado" se existir
  const dominante = [...rowsAll].sort((a,b)=>b[1]-a[1])[0];
  const pctDom = (dominante[1]/totalConhecido*100).toFixed(1);
  let nota = `<b>${pctDom}%</b> da carteira está em <b>${dominante[0]}</b>, recorte esperado das disputas ativas do escritório.`;
  if(naoInf > 0){
    const pctNi = (naoInf/total*100).toFixed(1);
    nota += ` <span style="color:var(--muted2)">· ${NUM(naoInf)} processos (${pctNi}%) sem instância cadastrada.</span>`;
  }
  document.getElementById('foro-inst-note').innerHTML = nota;
}

/* --- Nav sticky: shadow ao rolar + scrollspy --- */
function ativarNav(){
  const nav = document.getElementById('sidenav');
  if(!nav) return;
  // Copia o src da logo do hero para a sidebar (evita duplicar o base64)
  const heroLogo = document.querySelector('.hero-logo');
  const sidebarLogo = document.getElementById('sn-brand-logo');
  if(heroLogo && sidebarLogo){ sidebarLogo.src = heroLogo.src; }
  const listEl = document.getElementById('sidenav-list');
  const marker = document.getElementById('sn-marker');
  const links = nav.querySelectorAll('.sn-link');
  const secs = [...links].map(l=>document.getElementById(l.dataset.target)).filter(Boolean);

  // Move o marker para o link ativo (posição vertical relativa ao container)
  function moverMarker(link){
    if(!link || !marker) return;
    const rect = link.getBoundingClientRect();
    const parentRect = listEl.getBoundingClientRect();
    const top = rect.top - parentRect.top + listEl.scrollTop;
    marker.style.top = top + 'px';
    marker.style.height = rect.height + 'px';
    marker.classList.add('on');
  }

  // click → scroll suave
  links.forEach(l=>l.onclick=(e)=>{
    e.preventDefault();
    const t = document.getElementById(l.dataset.target);
    if(!t) return;
    const y = t.getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo({top:y,behavior:'smooth'});
  });

  // scrollspy customizado: encontra a seção mais próxima do topo do viewport
  function atualizarScrollspy(){
    const y = window.scrollY + 120; // offset de tolerância
    let atual = secs[0];
    for(const s of secs){
      if(s.offsetTop <= y) atual = s;
      else break;
    }
    if(!atual) return;
    let ativo = null;
    links.forEach(l=>{
      const on = l.dataset.target===atual.id;
      l.classList.toggle('on', on);
      if(on) ativo = l;
    });
    if(ativo) moverMarker(ativo);
  }
  window.addEventListener('scroll', atualizarScrollspy, {passive:true});

  // posição inicial do marker (no primeiro item ativo)
  const ativoInicial = nav.querySelector('.sn-link.on');
  if(ativoInicial){
    // espera as animações de entrada terminarem para pegar o rect final
    setTimeout(()=>moverMarker(ativoInicial), 620);
  }

  // reposiciona o marker em resize
  window.addEventListener('resize', ()=>{
    const a = nav.querySelector('.sn-link.on');
    if(a) moverMarker(a);
  });
}

/* --- Reveal on scroll (efeito ao passar por perto) --- */
function ativarReveal(){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); }
    });
  }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
}

/* Toggle de tema (claro/escuro) com persistência em localStorage */
function ativarTema(){
  const btn = document.getElementById('theme-toggle');
  const lbl = document.getElementById('theme-toggle-label');
  if(!btn) return;
  const salvo = localStorage.getItem('painel-tema');
  if(salvo === 'dark') document.body.classList.add('theme-dark');
  const atualizarLabel = ()=>{
    if(lbl) lbl.textContent = document.body.classList.contains('theme-dark') ? 'Tema claro' : 'Tema escuro';
  };
  atualizarLabel();
  btn.onclick = ()=>{
    document.body.classList.toggle('theme-dark');
    const isDark = document.body.classList.contains('theme-dark');
    localStorage.setItem('painel-tema', isDark ? 'dark' : 'light');
    atualizarLabel();
    // Re-renderiza o mapa do Brasil e o histograma jurídico para que as cores
    // sensíveis ao tema (heatmap do mapa e pill da mediana) sejam recalculadas.
    if(typeof renderForo === 'function') renderForo();
    if(typeof _renderTempoHist === 'function' && typeof GRUPOS !== 'undefined'){
      const gs = GRUPOS.filter(g=>g.tramitDias>0);
      if(gs.length){
        const dias = gs.map(g=>g.tramitDias).sort((a,b)=>a-b);
        const mediana = dias[Math.floor(dias.length/2)] || 0;
        _renderTempoHist(gs, mediana);
      }
    }
  };
}

/* Parallax leve nos cards ao rolar */
function ativarParallax(){
  const alvos = document.querySelectorAll('.panel, .tk-card, .exec-card, .pilha-card, .eff-sum-card');
  let ticking = false;
  const atualizar = ()=>{
    const centro = window.innerHeight/2;
    alvos.forEach(el=>{
      const rect = el.getBoundingClientRect();
      if(rect.bottom < -100 || rect.top > innerHeight+100) return;
      // distância do centro do card ao centro da tela (normalizada)
      const cardCenter = rect.top + rect.height/2;
      const dist = (cardCenter - centro) / innerHeight; // -0.5 a 0.5 aprox.
      // Um leve translateY proporcional (max ~10px), na direção oposta ao scroll para dar profundidade
      const shift = Math.max(-8, Math.min(8, -dist * 12));
      el.style.setProperty('--parallax', `${shift}px`);
    });
    ticking = false;
  };
  const onScroll = ()=>{
    if(!ticking){ requestAnimationFrame(atualizar); ticking = true; }
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  atualizar();
}

/* Botão voltar ao topo: aparece após rolar 200px */
function ativarBackTop(){
  const btn = document.getElementById('back-top');
  if(!btn) return;
  const marcar = ()=>btn.classList.toggle('on', window.scrollY > 200);
  marcar();
  window.addEventListener('scroll', marcar, {passive:true});
  btn.onclick = ()=>window.scrollTo({top:0, behavior:'smooth'});
}

/* Adiciona classes de glow/sweep nos KPIs principais */
function marcarKpiDestaques(){
  // Halo pulsante nos 6 KPIs do hero e nos KPIs .tk-card das seções
  document.querySelectorAll('#kpirow .kpi .v').forEach(el=>el.classList.add('kpi-glow'));
  document.querySelectorAll('.tk-card .tk-num').forEach(el=>el.classList.add('kpi-glow'));
  // Sweep dourado periódico no card KPI de destaque (Movimentações — 5º card no hero)
  const dest = document.querySelectorAll('#kpirow .kpi');
  if(dest.length >= 5) dest[4].classList.add('kpi-sweep');
}

/* --- KPIs topo --- */
function renderKPIs(){
  const t = GRUPOS.reduce((a,g)=>({
    grupos:a.grupos+1, empresas:a.empresas+g.nEmpresas,
    proc:a.proc+g.proc, ativos:a.ativos+g.ativos,
    horas:a.horas+g.horas, mov:a.mov+g.mov
  }),{grupos:0,empresas:0,proc:0,ativos:0,horas:0,mov:0});
  const areasSet = new Set(); GRUPOS.forEach(g=>Object.keys(g.area).forEach(a=>areasSet.add(a)));
  const anyEst = GRUPOS.some(g=>g.horasEst);
  const kpis = [
    {v:NUM(t.proc), l:'Processos', s:NUM(t.empresas)+' empresas'},
    {v:NUM(t.ativos), l:'Ativos', s:Math.round(t.ativos/t.proc*100)+'% da carteira'},
    {v:NUM(t.grupos), l:'Grupos econômicos', s:'clientes gerenciados'},
    {v:NUM(areasSet.size), l:'Áreas do direito', s:'cobertas na carteira'},
    {v:NUM(t.mov), l:'Movimentações', s:'prazos + aud. + diligências'},
    {v:(anyEst?'^':'')+NUM(t.horas), l:'Horas apontadas', s:'timesheet acumulado'}
  ];
  document.getElementById('kpirow').innerHTML = kpis.map(k=>`
    <div class="kpi"><div class="v">${k.v.replace('^','<small>~</small>')}</div>
    <div class="l">${k.l}</div><div class="s">${k.s}</div></div>`).join('');
}

/* --- Ranking com métrica alternável --- */
const METRICS = [
  {key:'proc', label:'Processos', fmt:NUM, gold:false, sub:g=>g.ativos+' ativos'},
  {key:'ativos', label:'Processos ativos', fmt:NUM, gold:false, sub:g=>g.proc+' no total'},
  {key:'mov', label:'Movimentação', fmt:NUM, gold:true, sub:g=>g.prazos+' prazos'},
  {key:'horas', label:'Horas', fmt:NUM, gold:true, sub:g=>g.horasEst?'estimativa':'real'},
];
let curMetric = 'mov';
let rankExpandido = false; // começa em Top 15
let rankFiltro = '';
const RANK_TOP = 15;

function renderRanking(){
  const tabs = document.getElementById('metric-tabs');
  tabs.innerHTML = METRICS.map(m=>`<button data-k="${m.key}" class="${m.key===curMetric?'on':''}">${m.label}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    if(b.dataset.k===curMetric) return;
    curMetric=b.dataset.k;
    renderRanking();
  });

  const m = METRICS.find(x=>x.key===curMetric);
  const q = rankFiltro.trim().toLowerCase();
  const filtrados = q ? GRUPOS.filter(g=>g.nome.toLowerCase().includes(q)) : GRUPOS;
  const ordenados = [...filtrados].sort((a,b)=>b[m.key]-a[m.key]);
  const limite = (rankExpandido || q) ? ordenados.length : Math.min(RANK_TOP, ordenados.length);
  const rows = ordenados.slice(0, limite);
  const max = Math.max(...ordenados.map(r=>r[m.key]),1);

  const container = document.getElementById('ranking-bars');
  container.innerHTML = rows.map((g,i)=>{
    const v = g[m.key], pct = (v/max*100);
    const est = (m.key==='horas' && g.horasEst) ? '<span class="est-mark" data-tt="Total de horas por estimativa">^</span>' : '';
    const podium = i===0?' top1':i===1?' top2':i===2?' top3':'';
    const medalha = i+1;
    // pct do total do escritório (não do top)
    const totalMetric = GRUPOS.reduce((s,x)=>s+(x[m.key]||0),0)||1;
    const pctTot = (v/totalMetric*100).toFixed(1);
    return `<div class="bar-row${podium}" style="animation-delay:${Math.min(i*35,700)}ms" data-tt="<b>${g.nome}</b><br>${m.label}: ${m.fmt(v)}<br>${pctTot}% do total do escritório">
      <div class="name" title="${g.nome}"><span class="rk-badge">${medalha}</span>${g.nome.replace(/^Grupo\s+/,'')}</div>
      <div class="bar-track"><div class="bar-fill ${m.gold?'gold':''}" style="width:0" data-w="${pct}" data-v="${v}"></div></div>
      <div class="val"><span class="v-num" data-final="${v}">${est}0</span><small>${m.sub(g)}</small></div>
    </div>`;
  }).join('');

  // anima barras + shimmer + count-up com atraso escalonado
  setTimeout(()=>{
    container.querySelectorAll('.bar-row').forEach((row,i)=>{
      const fill = row.querySelector('.bar-fill');
      const vNum = row.querySelector('.v-num');
      if(!fill || !vNum) return;
      const alvo = +fill.dataset.v;
      const est = (m.key==='horas' && rows[i].horasEst) ? '<span class="est-mark" data-tt="Total de horas por estimativa">^</span>' : '';
      setTimeout(()=>{
        fill.style.width = fill.dataset.w + '%';
        fill.classList.add('go');
        // count-up com setInterval (30 fps ~ 33ms) — evita quirks do rAF
        const dur = 900;
        const passos = 30;
        let k = 0;
        const iv = setInterval(()=>{
          k++;
          const p = k/passos;
          const e = 1 - Math.pow(1-p, 5);
          if(k < passos){
            vNum.innerHTML = est + NUM(Math.round(alvo*e));
          } else {
            vNum.innerHTML = est + m.fmt(alvo);
            clearInterval(iv);
          }
        }, dur/passos);
      }, Math.min(i*35,700) + 50);
    });
  }, 30);

  // botão expand: aparece só quando há mais que RANK_TOP e não está filtrando
  const footer = document.querySelector('.rank-footer');
  const btn = document.getElementById('rank-expand');
  const total = ordenados.length;
  if(!q && total > RANK_TOP){
    footer.style.display='flex';
    if(rankExpandido){
      btn.innerHTML = 'Recolher (voltar ao top ' + RANK_TOP + ')';
    } else {
      btn.innerHTML = `Ver todos os <span id="rank-count">${total}</span> grupos`;
    }
    btn.onclick = ()=>{ rankExpandido = !rankExpandido; renderRanking(); };
  } else {
    footer.style.display='none';
  }

  attachTT();
}

// filtro (fora do renderRanking para não recolocar listener toda vez)
function ativarFiltroRank(){
  const inp = document.getElementById('rank-filtro');
  const clr = document.getElementById('rank-filtro-clear');
  if(!inp) return;
  const wrap = inp.parentElement;
  const atualizarWrap = ()=>wrap.classList.toggle('has', !!inp.value);
  inp.addEventListener('input', ()=>{
    rankFiltro = inp.value;
    atualizarWrap();
    renderRanking();
  });
  clr.addEventListener('click', ()=>{
    inp.value=''; rankFiltro=''; atualizarWrap(); renderRanking(); inp.focus();
  });
}

/* --- Áreas: donut animado + card Especialização + ranking por área --- */
// estado interno
let curArea = '__all__';           // qual área está selecionada nas tabs
let areaExpandido = false;
let areaFiltro = '';
const AREA_TOP = 15;

function renderArea(){
  // agregação do escritório
  const agg = {};
  GRUPOS.forEach(g=>Object.entries(g.area).forEach(([a,q])=>{agg[a]=(agg[a]||0)+q;}));
  const areasOrd = Object.entries(agg).sort((a,b)=>b[1]-a[1]);
  const totalAg = areasOrd.reduce((s,[,q])=>s+q,0)||1;

  _renderDonut(areasOrd, totalAg);
  _renderInsight(areasOrd, totalAg);
  _renderAreaRanking(areasOrd);
}

// A) Donut animado + hover destaque
function _renderDonut(areasOrd, totalAg){
  const R=88, CX=120, CY=120, C=2*Math.PI*R;
  const segsData = [];
  let off=0;
  areasOrd.forEach(([a,q],i)=>{
    const frac = q/totalAg, len = frac*C;
    segsData.push({a, q, i, frac, off, len, cor: colorFor(a,i)});
    off += len;
  });
  const segs = segsData.map(s=>`
    <circle data-area="${s.a}" cx="${CX}" cy="${CY}" r="${R}" fill="none"
      stroke="${s.cor}" stroke-width="28"
      stroke-dasharray="0 ${C}"
      stroke-dashoffset="${-s.off}"
      transform="rotate(-90 ${CX} ${CY})"
      data-final-dash="${s.len} ${C - s.len}"
      data-tt="<b>${s.a}</b><br>${NUM(s.q)} ativos · ${Math.round(s.frac*100)}%<br>${_topGruposArea(s.a)}"
    ></circle>`).join('');

  // legenda ao lado
  const legenda = areasOrd.slice(0,10).map(([a,q],i)=>`
    <div class="ad-leg-item" data-area="${a}" style="display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 6px;border-radius:4px;cursor:pointer;transition:background .18s">
      <span style="width:12px;height:12px;border-radius:3px;background:${colorFor(a,i)};flex:0 0 auto"></span>
      <span style="font-weight:600;color:var(--navy);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${a}">${a}</span>
      <span style="font-weight:800;color:var(--navy2);font-variant-numeric:tabular-nums">${NUM(q)}</span>
      <span style="color:var(--muted);font-weight:600;width:36px;text-align:right">${Math.round(q/totalAg*100)}%</span>
    </div>`).join('');

  const el = document.getElementById('area-donut');
  el.innerHTML = `
    <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
      <svg id="ad-svg" width="240" height="240" viewBox="0 0 240 240" style="flex:0 0 auto">
        ${segs}
        <text id="ad-num" x="${CX}" y="${CY-4}" text-anchor="middle" style="font-size:30px;font-weight:800;fill:var(--navy);letter-spacing:-1px">0</text>
        <text x="${CX}" y="${CY+16}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:var(--muted);letter-spacing:1px">ATIVOS</text>
      </svg>
      <div id="ad-legend" style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:2px">
        ${legenda}
      </div>
    </div>`;

  // anima segmentos: dash cresce do 0 até o valor final
  const svg = document.getElementById('ad-svg');
  const circles = svg.querySelectorAll('circle');
  setTimeout(()=>{
    circles.forEach((c,i)=>{
      setTimeout(()=>{
        c.style.transition = 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)';
        c.setAttribute('stroke-dasharray', c.dataset.finalDash);
      }, i*60);
    });
    // count-up no número central
    const numEl = document.getElementById('ad-num');
    const dur=1100, passos=35; let k=0;
    const iv = setInterval(()=>{
      k++;
      const p = k/passos, e = 1-Math.pow(1-p,5);
      numEl.textContent = NUM(Math.round(totalAg*e));
      if(k>=passos){ numEl.textContent = NUM(totalAg); clearInterval(iv); }
    }, dur/passos);
  }, 100);

  // hover destaque: no segmento ou na legenda, destaca o outro
  const destacar = (area)=>{
    if(area){
      svg.classList.add('hover');
      circles.forEach(c=>c.classList.toggle('hi', c.dataset.area===area));
      el.querySelectorAll('.ad-leg-item').forEach(li=>li.style.background = li.dataset.area===area ? 'var(--paper2)' : '');
    } else {
      svg.classList.remove('hover');
      circles.forEach(c=>c.classList.remove('hi'));
      el.querySelectorAll('.ad-leg-item').forEach(li=>li.style.background='');
    }
  };
  circles.forEach(c=>{
    c.addEventListener('mouseenter', ()=>destacar(c.dataset.area));
    c.addEventListener('mouseleave', ()=>destacar(null));
    c.addEventListener('click', ()=>{ curArea = c.dataset.area; renderArea(); document.getElementById('sec-area').scrollIntoView({block:'start',behavior:'smooth'}); });
  });
  el.querySelectorAll('.ad-leg-item').forEach(li=>{
    li.addEventListener('mouseenter', ()=>destacar(li.dataset.area));
    li.addEventListener('mouseleave', ()=>destacar(null));
    li.addEventListener('click', ()=>{ curArea = li.dataset.area; renderArea(); });
  });
  attachTT();
}

function _topGruposArea(area){
  return [...GRUPOS]
    .map(g=>({n:g.nome.replace(/^Grupo\s+/,''), q:g.area[area]||0}))
    .filter(x=>x.q>0)
    .sort((a,b)=>b.q-a.q).slice(0,5)
    .map(x=>`${x.n}: <b>${NUM(x.q)}</b>`).join('<br>');
}

// B) Card Especialização (top áreas do escritório)
function _renderInsight(areasOrd, totalAg){
  const [nomeArea, qtdArea] = areasOrd[0] || ['sem registro',0];
  const pct = (qtdArea/totalAg*100);
  document.getElementById('area-insight-headline').innerHTML =
    `${pct.toFixed(1)}<span style="font-size:22px;font-weight:700;color:var(--gold-soft);margin-left:2px">%</span>
     <span class="ai-area">${nomeArea}</span>`;
  document.getElementById('area-insight-sub').innerHTML =
    `<b style="color:#fff">${NUM(qtdArea)}</b> de ${NUM(totalAg)} processos ativos concentram-se na área dominante do escritório.`;
  // top 4 áreas seguintes + linha final agregando o resto (para fechar 100%)
  const proximas = areasOrd.slice(1,5);
  const restantes = areasOrd.slice(5);
  const qtdRest = restantes.reduce((s,[,q])=>s+q, 0);
  const nRest = restantes.length;
  const proximasHTML = proximas.map(([a,q])=>`
    <div class="ai-item"><span class="lbl">${a}</span><span class="val">${NUM(q)} · ${(q/totalAg*100).toFixed(1)}%</span></div>`).join('');
  const restanteHTML = nRest > 0 ? `
    <div class="ai-item" style="border-top:1px dashed rgba(255,255,255,.15);padding-top:8px;margin-top:2px">
      <span class="lbl" style="font-style:italic">+ ${nRest} outras áreas</span>
      <span class="val">${NUM(qtdRest)} · ${(qtdRest/totalAg*100).toFixed(1)}%</span>
    </div>` : '';
  document.getElementById('area-insight-list').innerHTML = proximasHTML + restanteHTML;
}

// C) Ranking por área — tabs (áreas), filtro, top-3, count-up, ver todos
function _renderAreaRanking(areasOrd){
  const totalAll = areasOrd.reduce((s,[,q])=>s+q,0)||1;
  // tabs: "Todas" + top 8 áreas
  const areasTab = [{k:'__all__',lbl:'Todas'}].concat(areasOrd.slice(0,8).map(([a])=>({k:a,lbl:a})));
  const tabs = document.getElementById('area-tabs');
  tabs.innerHTML = areasTab.map(t=>`<button data-k="${t.k}" class="${t.k===curArea?'on':''}">${t.lbl}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.dataset.k!==curArea){ curArea=b.dataset.k; areaExpandido=false; _renderAreaRanking(areasOrd); } });

  const q = areaFiltro.trim().toLowerCase();
  const filtroFn = g => !q || g.nome.toLowerCase().includes(q);

  let ordenados, chave, labelMetrica, subFn, formatoVal, gold=false;
  if(curArea==='__all__'){
    // ranking por ativos (fallback)
    ordenados = [...GRUPOS].filter(g=>g.ativos>0).filter(filtroFn).sort((a,b)=>b.ativos-a.ativos);
    chave = g=>g.ativos;
    labelMetrica = 'Processos ativos';
    subFn = g=>Object.keys(g.area).length + ' áreas';
    formatoVal = v=>NUM(v);
  } else {
    ordenados = [...GRUPOS].map(g=>({...g, qArea:g.area[curArea]||0})).filter(g=>g.qArea>0).filter(filtroFn).sort((a,b)=>b.qArea-a.qArea);
    chave = g=>g.qArea;
    labelMetrica = curArea;
    subFn = g=>`${(g.qArea/g.ativos*100).toFixed(0)}% da carteira ativa`;
    formatoVal = v=>NUM(v);
    gold = true;
  }

  const limite = (areaExpandido || q) ? ordenados.length : Math.min(AREA_TOP, ordenados.length);
  const rows = ordenados.slice(0, limite);
  const max = Math.max(...ordenados.map(chave),1);

  const container = document.getElementById('area-bars');
  container.innerHTML = rows.length ? rows.map((g,i)=>{
    const v = chave(g), pct = v/max*100;
    const pctEsc = (v/totalAll*100).toFixed(1);
    const podium = i===0?' top1':i===1?' top2':i===2?' top3':'';
    return `<div class="bar-row${podium}" style="animation-delay:${Math.min(i*35,700)}ms" data-tt="<b>${g.nome}</b><br>${labelMetrica}: ${formatoVal(v)}<br>${pctEsc}% do total do escritório na área">
      <div class="name" title="${g.nome}"><span class="rk-badge">${i+1}</span>${g.nome.replace(/^Grupo\s+/,'')}</div>
      <div class="bar-track"><div class="bar-fill ${gold?'gold':''}" style="width:0" data-w="${pct}" data-v="${v}"></div></div>
      <div class="val"><span class="v-num" data-final="${v}">0</span><small>${subFn(g)}</small></div>
    </div>`;
  }).join('') : `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">Nenhum grupo encontrado${q?' com esse filtro':''}.</div>`;

  // anima
  setTimeout(()=>{
    container.querySelectorAll('.bar-row').forEach((row,i)=>{
      const fill = row.querySelector('.bar-fill');
      const vNum = row.querySelector('.v-num');
      if(!fill||!vNum) return;
      const alvo = +fill.dataset.v;
      setTimeout(()=>{
        fill.style.width = fill.dataset.w + '%';
        fill.classList.add('go');
        const dur=900, passos=30; let k=0;
        const iv = setInterval(()=>{
          k++;
          const p = k/passos, e = 1-Math.pow(1-p,5);
          if(k<passos){ vNum.textContent = NUM(Math.round(alvo*e)); }
          else { vNum.textContent = NUM(alvo); clearInterval(iv); }
        }, dur/passos);
      }, Math.min(i*35,700)+50);
    });
  }, 30);

  // botão expand
  const footer = container.parentElement.querySelector('.rank-footer');
  const btn = document.getElementById('area-expand');
  if(!q && ordenados.length > AREA_TOP){
    footer.style.display='flex';
    btn.textContent = areaExpandido ? `Recolher (voltar ao top ${AREA_TOP})` : `Ver todos os ${ordenados.length} grupos`;
    btn.onclick = ()=>{ areaExpandido = !areaExpandido; _renderAreaRanking(areasOrd); };
  } else {
    footer.style.display='none';
  }
  attachTT();
}

// filtro do bloco Áreas
function ativarFiltroArea(){
  const inp = document.getElementById('area-filtro');
  const clr = document.getElementById('area-filtro-clear');
  if(!inp) return;
  const wrap = inp.parentElement;
  const atualizarWrap = ()=>wrap.classList.toggle('has', !!inp.value);
  inp.addEventListener('input', ()=>{
    areaFiltro = inp.value;
    atualizarWrap();
    // recalcula com areasOrd atual do escritório
    const agg = {};
    GRUPOS.forEach(g=>Object.entries(g.area).forEach(([a,q])=>{agg[a]=(agg[a]||0)+q;}));
    const areasOrd = Object.entries(agg).sort((a,b)=>b[1]-a[1]);
    _renderAreaRanking(areasOrd);
  });
  clr.addEventListener('click', ()=>{
    inp.value=''; areaFiltro=''; atualizarWrap();
    const agg = {};
    GRUPOS.forEach(g=>Object.entries(g.area).forEach(([a,q])=>{agg[a]=(agg[a]||0)+q;}));
    const areasOrd = Object.entries(agg).sort((a,b)=>b[1]-a[1]);
    _renderAreaRanking(areasOrd);
    inp.focus();
  });
}

/* --- Eficiência: Matriz 2×2 (quadrantes) --- */
let effFiltro = '';

// classifica um grupo em Q1/Q2/Q3/Q4 usando as médias medX/medY como divisores.
// X = processos ativos, Y = horas apontadas.
//   Q1 (topo-esq): baixa carteira + alto esforço → "Peso desproporcional"  (dq3)
//   Q2 (topo-dir): alta carteira + alto esforço → "Vítimas do sucesso"    (dq1)
//   Q3 (base-esq): baixa carteira + baixo esforço → "Dormência"           (dq4)
//   Q4 (base-dir): alta carteira + baixo esforço → "Eficientes"           (dq2)
function _quadrante(g, medX, medY){
  const hi_x = g.ativos >= medX;
  const hi_y = g.horas  >= medY;
  if(hi_x && hi_y) return {k:'q1', cls:'dq1', cor:'#B58642', nome:'Vítimas do sucesso'};
  if(hi_x && !hi_y) return {k:'q2', cls:'dq2', cor:'#2f7a44', nome:'Eficientes'};
  if(!hi_x && hi_y) return {k:'q3', cls:'dq3', cor:'#8a6534', nome:'Peso desproporcional'};
  return {k:'q4', cls:'dq4', cor:'#7a7f96', nome:'Dormência'};
}

function renderEficienciaMatriz(){
  const container = document.getElementById('eff-matriz');
  const q = effFiltro.trim().toLowerCase();

  // universo: grupos com ativos > 0 e horas > 0 (para caber na matriz)
  const universo = GRUPOS.filter(g=>g.ativos>0 && g.horas>0);
  if(!universo.length){ container.innerHTML = '<div style="padding:24px;color:var(--muted)">Sem dados.</div>'; return; }

  // divisores: mediana dos ativos e mediana das horas (mais robusto que média com outliers)
  const sortedX = [...universo.map(g=>g.ativos)].sort((a,b)=>a-b);
  const sortedY = [...universo.map(g=>g.horas)].sort((a,b)=>a-b);
  const medX = sortedX[Math.floor(sortedX.length/2)];
  const medY = sortedY[Math.floor(sortedY.length/2)];

  // ranking por "peso combinado" (ativos + horas normalizados) para escolher os visíveis
  const maxA = Math.max(...universo.map(g=>g.ativos));
  const maxH = Math.max(...universo.map(g=>g.horas));
  const peso = g => (g.ativos/maxA)+(g.horas/maxH);
  const universoOrdenado = [...universo].sort((a,b)=>peso(b)-peso(a));
  // sempre mantemos os 24 mais pesados; se filtro, exibimos os do filtro
  const alvo = q ? universo.filter(g=>g.nome.toLowerCase().includes(q)) : universoOrdenado.slice(0, 24);

  // escala log para os eixos (X e Y têm grande variância)
  const logX = v => Math.log10(Math.max(v,1));
  const logY = v => Math.log10(Math.max(v,1));
  const xMin = Math.min(...universo.map(g=>logX(g.ativos))), xMax = Math.max(...universo.map(g=>logX(g.ativos)));
  const yMin = Math.min(...universo.map(g=>logY(g.horas))),  yMax = Math.max(...universo.map(g=>logY(g.horas)));

  // dimensões SVG (relativo ao viewBox)
  const W=1000, H=440, P={l:52,r:36,t:34,b:56};
  const xPos = v => P.l + (logX(v)-xMin)/(xMax-xMin) * (W-P.l-P.r);
  const yPos = v => H-P.b - (logY(v)-yMin)/(yMax-yMin) * (H-P.t-P.b);
  const rad = g => {
    // raio pelo mov (esforço bruto), com piso e teto
    const maxMov = Math.max(...universo.map(g=>g.mov),1);
    return 10 + Math.sqrt(g.mov/maxMov)*22;
  };
  const xMed = xPos(medX), yMed = yPos(medY);

  // Nós posicionados
  const posics = alvo.map(g=>({g, cx:xPos(g.ativos), cy:yPos(g.horas), r:rad(g), quad:_quadrante(g, medX, medY)}));

  // labels anticolisão simples
  const placed = [];
  posics.sort((a,b)=>a.cy-b.cy).forEach(n=>{
    let ly = n.cy - n.r - 8, lx = n.cx;
    let guard=0;
    while(guard++<25 && placed.some(p=>Math.abs(p.lx-lx)<58 && Math.abs(p.ly-ly)<16)){
      ly -= 14;
      if(ly < 20){ ly = n.cy + n.r + 16; lx = n.cx + (guard%2?24:-24); }
    }
    n.lx = lx; n.ly = ly;
    placed.push({lx, ly});
  });

  // linhas divisoras da mediana (cruz principal)
  const cross = `
    <line x1="${xMed}" y1="${P.t}" x2="${xMed}" y2="${H-P.b}" stroke="var(--navy)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".38"/>
    <line x1="${P.l}" y1="${yMed}" x2="${W-P.r}" y2="${yMed}" stroke="var(--navy)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".38"/>
    <text x="${xMed+6}" y="${P.t+12}" style="font-size:9px;fill:var(--muted);font-weight:700;letter-spacing:.6px">MEDIANA ${NUM(medX)} ativos</text>
    <text x="${W-P.r-4}" y="${yMed-4}" text-anchor="end" style="font-size:9px;fill:var(--muted);font-weight:700;letter-spacing:.6px">MEDIANA ${NUM(Math.round(medY))} h</text>
  `;

  // ticks nas escalas (log). Escolhemos alguns pontos representativos.
  const xTicks = [10,50,100,300,700].filter(v=>v>=Math.pow(10,xMin)*0.5 && v<=Math.pow(10,xMax)*1.5);
  const yTicks = [100,500,2000,8000,25000].filter(v=>v>=Math.pow(10,yMin)*0.5 && v<=Math.pow(10,yMax)*1.5);
  let ticks = '';
  xTicks.forEach(v=>{
    ticks += `<text x="${xPos(v)}" y="${H-P.b+14}" text-anchor="middle" style="font-size:9.5px;fill:var(--muted2);font-weight:600">${NUM(v)}</text>`;
  });
  yTicks.forEach(v=>{
    ticks += `<text x="${P.l-8}" y="${yPos(v)+3}" text-anchor="end" style="font-size:9.5px;fill:var(--muted2);font-weight:600">${NUM(v)}</text>`;
  });

  // rótulos dos eixos
  const eixos = `
    <text x="${(W+P.l-P.r)/2}" y="${H-6}" text-anchor="middle" style="font-size:11px;fill:var(--navy);font-weight:800;letter-spacing:1.4px">CARTEIRA (processos ativos) →</text>
    <text transform="rotate(-90 20 ${(H-P.b+P.t)/2})" x="20" y="${(H-P.b+P.t)/2}" text-anchor="middle" style="font-size:11px;fill:var(--navy);font-weight:800;letter-spacing:1.4px">ESFORÇO (horas apontadas) →</text>
  `;

  // Nós SVG (com r=0 pra animar)
  const nodes = posics.map((n,i)=>{
    const est = n.g.horasEst ? '^' : '';
    return `<g class="eff-node" data-i="${i}" data-cod="${n.g.cod}">
      <circle cx="${n.cx}" cy="${n.cy}" r="0" data-final-r="${n.r}"
        fill="${n.quad.cor}" fill-opacity=".82" stroke="#fff" stroke-width="2"
        data-tt="<b>${n.g.nome}</b><br>${NUM(n.g.ativos)} ativos · ${est}${NUM(n.g.horas)}h<br>${(n.g.horas/n.g.ativos).toFixed(1)} h/ativo<br><i>${n.quad.nome}</i>"></circle>
      <line x1="${n.cx}" y1="${n.cy}" x2="${n.lx}" y2="${n.ly+3}" stroke="var(--muted2)" stroke-width=".7" opacity=".35"/>
      <text x="${n.lx}" y="${n.ly}" text-anchor="middle">${n.g.cod.toUpperCase()}${est}</text>
    </g>`;
  }).join('');

  container.innerHTML = `
    <div class="eff-stage">
      <div class="eff-quad-labels">
        <div class="eff-ql q1">Baixa carteira · alto esforço<b>Peso desproporcional</b></div>
        <div class="eff-ql q2">Alta carteira · alto esforço<b>Vítimas do sucesso</b></div>
        <div class="eff-ql q3">Baixa carteira · baixo esforço<b>Dormência</b></div>
        <div class="eff-ql q4">Alta carteira · baixo esforço<b>Eficientes</b></div>
      </div>
      <svg class="eff-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${cross}
        ${ticks}
        ${eixos}
        ${nodes}
      </svg>
    </div>`;

  // anima os raios de 0 até o final
  setTimeout(()=>{
    container.querySelectorAll('.eff-node circle').forEach((c,i)=>{
      const r = c.dataset.finalR;
      setTimeout(()=>{
        c.style.transition = 'r .55s cubic-bezier(.22,1,.36,1)';
        c.setAttribute('r', r);
      }, i*22);
    });
  }, 40);

  // hover destaca
  container.querySelectorAll('.eff-node').forEach(n=>{
    n.addEventListener('mouseenter', ()=>{
      container.querySelectorAll('.eff-node').forEach(x=>x.classList.toggle('hi', x===n));
    });
    n.addEventListener('mouseleave', ()=>{
      container.querySelectorAll('.eff-node').forEach(x=>x.classList.remove('hi'));
    });
  });

  // Resumo: contagem por quadrante e nomes destacados
  _renderEffSummary(universo, medX, medY);

  attachTT();
}

function _renderEffSummary(universo, medX, medY){
  const grupos = {q1:[], q2:[], q3:[], q4:[]};
  universo.forEach(g=>grupos[_quadrante(g,medX,medY).k].push(g));
  const defs = [
    {k:'q1', title:'Vítimas do sucesso', desc:'alta carteira · alto esforço', hint:'atenção operacional',  cor:'#B58642'},
    {k:'q2', title:'Eficientes',        desc:'alta carteira · baixo esforço', hint:'carteira de volume',    cor:'#2f7a44'},
    {k:'q3', title:'Peso desproporcional',desc:'baixa carteira · alto esforço', hint:'possível concentração',cor:'#8a6534'},
    {k:'q4', title:'Dormência',         desc:'baixa carteira · baixo esforço', hint:'monitorar retomada',    cor:'#7a7f96'}
  ];
  const html = defs.map(d=>{
    const gs = [...grupos[d.k]].sort((a,b)=>(b.ativos+b.horas/1000)-(a.ativos+a.horas/1000)).slice(0,3);
    const lista = gs.map(g=>`<b>${g.nome.replace(/^Grupo\s+/,'')}</b>`).join(' · ') || '<i>sem grupos neste perfil</i>';
    return `<div class="eff-sum-card ${d.k}">
      <div class="esc-eyebrow">${d.title}</div>
      <div class="esc-title">${d.desc}</div>
      <div class="esc-num" data-target="${grupos[d.k].length}">0<small> grupos</small></div>
      <div class="esc-list">${lista}</div>
    </div>`;
  }).join('');
  document.getElementById('eff-summary').innerHTML = html;
  // count-up dos números
  document.querySelectorAll('#eff-summary .esc-num').forEach((el,i)=>{
    const alvo = +el.dataset.target;
    setTimeout(()=>{
      const dur=900, passos=30; let k=0;
      const iv = setInterval(()=>{
        k++;
        const p = k/passos, e = 1-Math.pow(1-p,5);
        if(k<passos) el.firstChild.textContent = Math.round(alvo*e);
        else { el.firstChild.textContent = alvo; clearInterval(iv); }
      }, dur/passos);
    }, i*80 + 200);
  });
}

// filtro Eficiência
function ativarFiltroEff(){
  const inp = document.getElementById('eff-filtro');
  const clr = document.getElementById('eff-filtro-clear');
  if(!inp) return;
  const wrap = inp.parentElement;
  const atualizarWrap = ()=>wrap.classList.toggle('has', !!inp.value);
  inp.addEventListener('input', ()=>{
    effFiltro = inp.value;
    atualizarWrap();
    renderEficienciaMatriz();
  });
  clr.addEventListener('click', ()=>{
    inp.value=''; effFiltro=''; atualizarWrap(); renderEficienciaMatriz(); inp.focus();
  });
}

/* --- (legado) Eficiência barras — não é mais chamada, mantida caso outra parte referencie --- */
function renderEficiencia(){ /* deprecated: integrado em renderEficienciaMatriz */ }

/* --- Panorama tabela ordenável --- */
let sortKey='proc', sortDir=-1;
let panoView = 'top15'; // top15 | top30 | all
let panoFiltro = '';

function renderPano(){
  const cols=[
    {k:'nome',l:'Grupo',n:false, gold:false, spark:false},
    {k:'nEmpresas',l:'Emp.',n:true, gold:false, spark:false},
    {k:'proc',l:'Proc.',n:true, gold:false, spark:true},
    {k:'ativos',l:'Ativos',n:true, gold:false, spark:true, pri:true},
    {k:'encerrados',l:'Encerr.',n:true, gold:false, spark:false},
    {k:'prazos',l:'Prazos',n:true, gold:true, spark:false},
    {k:'aud',l:'Aud.',n:true, gold:true, spark:false},
    {k:'reun',l:'Diligênc.',n:true, gold:true, spark:false},
    {k:'horas',l:'Horas',n:true, gold:true, spark:true, pri:true},
  ];

  const q = panoFiltro.trim().toLowerCase();
  const base = q ? GRUPOS.filter(g=>g.nome.toLowerCase().includes(q)) : [...GRUPOS];
  const ordenados = base.sort((a,b)=>{
    const va=a[sortKey],vb=b[sortKey];
    if(typeof va==='string') return sortDir*va.localeCompare(vb);
    return sortDir*((va||0)-(vb||0));
  });

  // limite conforme view
  let limite;
  if(q){ limite = ordenados.length; }
  else if(panoView === 'top15'){ limite = Math.min(15, ordenados.length); }
  else if(panoView === 'top30'){ limite = Math.min(30, ordenados.length); }
  else { limite = ordenados.length; }
  const rows = ordenados.slice(0, limite);

  // máximos por coluna (do universo TOTAL — não do slice — para sparkbars corretas)
  const maxCol = {};
  cols.filter(c=>c.spark).forEach(c=>{ maxCol[c.k] = Math.max(...GRUPOS.map(g=>g[c.k]||0), 1); });

  // totais do escritório (universo total, sempre)
  const tot = GRUPOS.reduce((a,g)=>({nEmpresas:a.nEmpresas+g.nEmpresas,proc:a.proc+g.proc,ativos:a.ativos+g.ativos,encerrados:a.encerrados+g.encerrados,prazos:a.prazos+g.prazos,aud:a.aud+g.aud,reun:a.reun+g.reun,horas:a.horas+g.horas}),{nEmpresas:0,proc:0,ativos:0,encerrados:0,prazos:0,aud:0,reun:0,horas:0});

  const arrow=k=> k===sortKey ? (sortDir<0?' ▾':' ▴') : '';

  // gera célula
  function cell(g, c){
    const v = g[c.k];
    if(c.k === 'nome'){
      return `<td class="grp"><span class="grp-rank"></span>${g.nome}</td>`;
    }
    if(c.spark){
      const pct = ((v||0)/maxCol[c.k])*100;
      const est = (c.k==='horas' && g.horasEst) ? '<span class="est-mark" data-tt="estimativa">^</span>' : '';
      return `<td>
        <span class="pano-cell ${c.gold?'gold':''}${c.pri?' pri':''}">
          <span class="pv-num">${est}${NUM(v||0)}</span>
          <span class="pv-bar"><span class="pv-bar-fill" data-w="${pct}"></span></span>
        </span>
      </td>`;
    }
    if(c.k==='horas'){
      const est = g.horasEst ? '<span class="est-mark" data-tt="estimativa">^</span>' : '';
      return `<td>${est}${NUM(v||0)}</td>`;
    }
    return `<td>${typeof v==='number'?NUM(v):v}</td>`;
  }

  document.getElementById('pano-table').innerHTML=`
    <thead><tr>${cols.map(c=>`<th data-k="${c.k}" class="${c.k===sortKey?'on':''}">${c.l}${arrow(c.k)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((g,i)=>{
      const podium = (!q && (sortKey!=='nome')) ? (i===0?' top1':i===1?' top2':i===2?' top3':'') : '';
      return `<tr class="${podium.trim()}" style="animation-delay:${Math.min(i*22,500)}ms" data-rank="${i+1}">${cols.map(c=>cell(g,c)).join('')}</tr>`;
    }).join('')}</tbody>
    <tfoot><tr>
      <td>Escritório (${GRUPOS.length} grupos)</td>
      <td>${NUM(tot.nEmpresas)}</td>
      <td>${NUM(tot.proc)}</td>
      <td>${NUM(tot.ativos)}</td>
      <td>${NUM(tot.encerrados)}</td>
      <td>${NUM(tot.prazos)}</td>
      <td>${NUM(tot.aud)}</td>
      <td>${NUM(tot.reun)}</td>
      <td>${NUM(tot.horas)}</td>
    </tr></tfoot>`;

  // preenche o rank number nas células top-3 dinamicamente após render
  document.querySelectorAll('#pano-table tbody tr').forEach((tr,i)=>{
    const rk = tr.querySelector('.grp-rank');
    if(rk) rk.textContent = tr.dataset.rank;
  });

  // anima sparkbars (após breve delay para o CSS aplicar width:0)
  setTimeout(()=>{
    document.querySelectorAll('#pano-table .pv-bar-fill').forEach(f=>{
      f.style.width = f.dataset.w + '%';
    });
  }, 80);

  // sort click
  document.querySelectorAll('#pano-table th').forEach(th=>th.onclick=()=>{
    const k=th.dataset.k; if(k===sortKey) sortDir*=-1; else {sortKey=k;sortDir=(k==='nome'?1:-1);} renderPano();
  });

  // footer expand
  const footer = document.getElementById('pano-expand').parentElement;
  const btn = document.getElementById('pano-expand');
  if(!q && panoView !== 'all' && ordenados.length > limite){
    footer.style.display='flex';
    btn.textContent = panoView === 'top15'
      ? `Ver top 30 grupos`
      : `Ver todos os ${ordenados.length} grupos`;
    btn.onclick = ()=>{
      panoView = panoView === 'top15' ? 'top30' : 'all';
      document.querySelectorAll('#pano-view-tabs button').forEach(b=>b.classList.toggle('on', b.dataset.view===panoView));
      renderPano();
    };
  } else if(!q && panoView === 'all'){
    footer.style.display='flex';
    btn.textContent = 'Recolher para top 15';
    btn.onclick = ()=>{
      panoView = 'top15';
      document.querySelectorAll('#pano-view-tabs button').forEach(b=>b.classList.toggle('on', b.dataset.view==='top15'));
      renderPano();
    };
  } else {
    footer.style.display='none';
  }

  attachTT();
}

function ativarPano(){
  // tabs de view
  document.querySelectorAll('#pano-view-tabs button').forEach(b=>{
    b.onclick = ()=>{
      panoView = b.dataset.view;
      document.querySelectorAll('#pano-view-tabs button').forEach(x=>x.classList.toggle('on', x===b));
      renderPano();
    };
  });
  // filtro
  const inp = document.getElementById('pano-filtro');
  const clr = document.getElementById('pano-filtro-clear');
  if(!inp) return;
  const wrap = inp.parentElement;
  const atualizarWrap = ()=>wrap.classList.toggle('has', !!inp.value);
  inp.addEventListener('input', ()=>{
    panoFiltro = inp.value;
    atualizarWrap();
    renderPano();
  });
  clr.addEventListener('click', ()=>{
    inp.value=''; panoFiltro=''; atualizarWrap();
    renderPano(); inp.focus();
  });
}


/* --- Bloco B: Tempo médio de tramitação --- */
// Faixas etárias jurídicas: <1a, 1-3a, 3-5a, 5-10a, +10a
const TEMPO_FAIXAS = [
  {k:'verde',    label:'Até 1 ano',   min:0,      max:365,   cor:'linear-gradient(135deg,#78c290,#3a8c56)', hex:'#3a8c56'},
  {k:'amarelo',  label:'1 a 3 anos',  min:365,    max:1095,  cor:'linear-gradient(135deg,#efd076,#c9a54a)', hex:'#c9a54a'},
  {k:'laranja',  label:'3 a 5 anos',  min:1095,   max:1825,  cor:'linear-gradient(135deg,#e5a06b,#b76a2e)', hex:'#b76a2e'},
  {k:'vermelho', label:'5 a 10 anos', min:1825,   max:3650,  cor:'linear-gradient(135deg,#d67f7a,#a63d38)', hex:'#a63d38'},
  {k:'critico',  label:'Mais de 10 anos', min:3650, max:Infinity, cor:'linear-gradient(135deg,#7a1c1c,#3d0d0d)', hex:'#7a1c1c'}
];
function _faixaDe(dias){
  return TEMPO_FAIXAS.find(f => dias >= f.min && dias < f.max) || TEMPO_FAIXAS[TEMPO_FAIXAS.length-1];
}

let tempoExpandido = false;
let tempoFiltro = '';
const TEMPO_TOP = 15;

function renderTempo(){
  const gs = GRUPOS.filter(g=>g.tramitDias>0);
  if(!gs.length){ return; }

  // Estatísticas do escritório
  const dias = gs.map(g=>g.tramitDias).sort((a,b)=>a-b);
  const mediana = dias[Math.floor(dias.length/2)] || 0;
  const media = dias.reduce((s,v)=>s+v,0)/dias.length;
  const lento = [...gs].sort((a,b)=>b.tramitDias-a.tramitDias)[0];

  // KPIs no topo
  _tempoAnimarKpi('tk-mediana', mediana, v => NUM(Math.round(v)));
  document.getElementById('tk-mediana-anos').textContent = (mediana/365).toFixed(1);
  _tempoAnimarKpi('tk-media', media, v => NUM(Math.round(v)));
  document.getElementById('tk-media-anos').textContent = (media/365).toFixed(1);
  _tempoAnimarKpi('tk-lento', lento.tramitDias, v => NUM(Math.round(v)));
  document.getElementById('tk-lento-nome').innerHTML = `<b style="color:var(--navy)">${lento.nome}</b> · ${(lento.tramitDias/365).toFixed(1)} anos`;

  // Faixas etárias
  _renderTempoFaixas(gs);

  // Card 'Envelhecimento crítico'
  _renderTempoCritico(gs);

  // Ranking com semaforização
  _renderTempoRanking(gs);

  // Histograma jurídico
  _renderTempoHist(gs, mediana);

  attachTT();
}

function _tempoAnimarKpi(elId, alvo, fmt){
  const el = document.getElementById(elId);
  if(!el) return;
  const dur=900, passos=32; let k=0;
  const iv = setInterval(()=>{
    k++;
    const p = k/passos, e = 1-Math.pow(1-p,5);
    el.textContent = fmt(alvo*e);
    if(k>=passos){ el.textContent = fmt(alvo); clearInterval(iv); }
  }, dur/passos);
}

// A) Faixas etárias (barras horizontais coloridas)
function _renderTempoFaixas(gs){
  // conta grupos por faixa
  const bins = TEMPO_FAIXAS.map(f => ({...f, grupos: [], qtdProc: 0}));
  gs.forEach(g=>{
    const f = _faixaDe(g.tramitDias);
    const idx = TEMPO_FAIXAS.findIndex(x=>x.k===f.k);
    bins[idx].grupos.push(g);
    bins[idx].qtdProc += g.ativos;
  });
  const totalGs = gs.length;
  const maxN = Math.max(...bins.map(b=>b.grupos.length),1);
  const container = document.getElementById('tempo-faixas');
  container.innerHTML = bins.map((b,i)=>{
    const n = b.grupos.length;
    const pct = n/maxN*100;
    const pctTot = totalGs ? (n/totalGs*100).toFixed(0) : '0';
    const topNomes = [...b.grupos].sort((a,b)=>b.tramitDias-a.tramitDias).slice(0,5).map(g=>g.nome.replace(/^Grupo\s+/,'')).join(' · ') || '<i>nenhum</i>';
    return `<div class="tempo-faixa-row" data-tt="<b>${b.label}</b><br>${n} grupos (${pctTot}%) · ${NUM(b.qtdProc)} processos ativos<br><br>${topNomes}">
      <div class="fx-name"><span class="fx-dot fx-c-${b.k}"></span>${b.label}</div>
      <div class="fx-track"><div class="fx-fill fx-c-${b.k}" style="width:0" data-w="${pct}"></div></div>
      <div class="fx-val">${n} <small>grupos · ${pctTot}%</small></div>
    </div>`;
  }).join('');
  // anima
  setTimeout(()=>{
    container.querySelectorAll('.fx-fill').forEach((f,i)=>{
      setTimeout(()=>f.style.width = f.dataset.w+'%', i*90+50);
    });
  }, 30);
}

// B) Card 'Envelhecimento crítico'
function _renderTempoCritico(gs){
  // considerado crítico = tramitDias > 1825 (5 anos)
  const criticos = gs.filter(g=>g.tramitDias > 1825);
  const totalCrit = criticos.reduce((s,g)=>s+g.ativos,0);
  const totalProcs = gs.reduce((s,g)=>s+g.ativos,0)||1;
  const pctCrit = totalCrit/totalProcs*100;
  document.getElementById('tc-head').innerHTML =
    `${criticos.length}<span class="tc-lbl">grupos com carteira &gt; 5 anos</span>`;
  document.getElementById('tc-sub').innerHTML =
    `<b style="color:#fff">${NUM(totalCrit)}</b> processos ativos, ${pctCrit.toFixed(1)}% da carteira. Casos suscetíveis a risco de prescrição ou paralisia processual.`;
  const top = [...criticos].sort((a,b)=>b.tramitDias-a.tramitDias).slice(0,5);
  document.getElementById('tc-list').innerHTML = top.map(g=>`
    <div class="tc-item"><span class="lbl">${g.nome.replace(/^Grupo\s+/,'')}</span>
      <span class="val">${(g.tramitDias/365).toFixed(1)} anos</span></div>`).join('')
    || '<div class="tc-item"><span class="lbl">Nenhum grupo crítico.</span></div>';
}

// C) Ranking semaforizado (por idade) + filtro + ver todos
function _renderTempoRanking(gs){
  const q = tempoFiltro.trim().toLowerCase();
  const filtrados = q ? gs.filter(g=>g.nome.toLowerCase().includes(q)) : gs;
  const ordenados = [...filtrados].sort((a,b)=>b.tramitDias-a.tramitDias);
  const limite = (tempoExpandido || q) ? ordenados.length : Math.min(TEMPO_TOP, ordenados.length);
  const rows = ordenados.slice(0, limite);
  const max = Math.max(...ordenados.map(r=>r.tramitDias),1);

  const container = document.getElementById('tempo-bars');
  container.innerHTML = rows.length ? rows.map((g,i)=>{
    const pct = g.tramitDias/max*100;
    const f = _faixaDe(g.tramitDias);
    const podium = i===0?' top1':i===1?' top2':i===2?' top3':'';
    return `<div class="bar-row${podium}" style="animation-delay:${Math.min(i*35,600)}ms" data-tt="<b>${g.nome}</b><br>${NUM(Math.round(g.tramitDias))} dias · ${(g.tramitDias/365).toFixed(1)} anos<br>${f.label}">
      <div class="name" title="${g.nome}"><span class="rk-badge">${i+1}</span>${g.nome.replace(/^Grupo\s+/,'')}</div>
      <div class="bar-track"><div class="bar-fill sem-${f.k}" style="width:0" data-w="${pct}" data-v="${g.tramitDias}"></div></div>
      <div class="val"><span class="v-num" data-final="${Math.round(g.tramitDias)}">0</span><small>${(g.tramitDias/365).toFixed(1)} anos</small></div>
    </div>`;
  }).join('') : `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">Nenhum grupo encontrado${q?' com esse filtro':''}.</div>`;

  // anima
  setTimeout(()=>{
    container.querySelectorAll('.bar-row').forEach((row,i)=>{
      const fill = row.querySelector('.bar-fill'), vNum = row.querySelector('.v-num');
      if(!fill||!vNum) return;
      const alvo = +fill.dataset.v;
      setTimeout(()=>{
        fill.style.width = fill.dataset.w+'%';
        fill.classList.add('go');
        const dur=850, passos=28; let k=0;
        const iv = setInterval(()=>{
          k++;
          const p=k/passos, e=1-Math.pow(1-p,5);
          if(k<passos) vNum.textContent = NUM(Math.round(alvo*e));
          else { vNum.textContent = NUM(Math.round(alvo)); clearInterval(iv); }
        }, dur/passos);
      }, Math.min(i*35,600)+40);
    });
  }, 30);

  // expand
  const footer = container.parentElement.querySelector('.rank-footer');
  const btn = document.getElementById('tempo-expand');
  if(!q && ordenados.length > TEMPO_TOP){
    footer.style.display='flex';
    btn.textContent = tempoExpandido ? `Recolher (voltar ao top ${TEMPO_TOP})` : `Ver todos os ${ordenados.length} grupos`;
    btn.onclick = ()=>{ tempoExpandido = !tempoExpandido; _renderTempoRanking(gs); };
  } else {
    footer.style.display='none';
  }
}

// D) Histograma jurídico (bins = faixas etárias, cores)
function _renderTempoHist(gs, mediana){
  const bins = TEMPO_FAIXAS.map(f => ({...f, grupos: []}));
  gs.forEach(g=>{
    const f = _faixaDe(g.tramitDias);
    const idx = TEMPO_FAIXAS.findIndex(x=>x.k===f.k);
    bins[idx].grupos.push(g);
  });
  const maxBin = Math.max(...bins.map(b=>b.grupos.length),1);
  const W=520, H=240, P={l:36,r:20,t:22,b:48};
  const bw = (W-P.l-P.r)/bins.length;
  const y = v => H-P.b - v/maxBin*(H-P.t-P.b);

  let rects='';
  bins.forEach((b,i)=>{
    const n = b.grupos.length;
    const xC = P.l + i*bw + bw/2;
    const rectW = bw*0.72;
    const rectX = xC - rectW/2;
    const rectY = y(n);
    const rectH = H-P.b - rectY;
    const nomes = [...b.grupos].sort((a,b)=>b.tramitDias-a.tramitDias).slice(0,6).map(g=>g.nome.replace(/^Grupo\s+/,'')).join('<br>');
    const mais = b.grupos.length>6 ? `<br><i>+${b.grupos.length-6} outros</i>` : '';
    rects += `<rect x="${rectX}" y="${H-P.b}" width="${rectW}" height="0"
      fill="${b.hex}" rx="4"
      data-anim-y="${rectY}" data-anim-h="${rectH}"
      data-tt="<b>${b.label}</b><br>${n} grupos<br><br>${nomes}${mais}"/>`;
    // numero em cima
    rects += `<text x="${xC}" y="${rectY-8}" text-anchor="middle" style="font-size:14px;font-weight:800;fill:var(--navy)">${n}</text>`;
    // label embaixo
    rects += `<text x="${xC}" y="${H-P.b+18}" text-anchor="middle" style="font-size:9.5px;font-weight:700;fill:var(--navy)">${b.label}</text>`;
  });

  // Linha da mediana como marcador
  const mFaixa = _faixaDe(mediana);
  const mIdx = TEMPO_FAIXAS.findIndex(x=>x.k===mFaixa.k);
  const mX = P.l + (mIdx+0.5)*bw;

  document.getElementById('tempo-hist').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
      <line x1="${P.l}" y1="${H-P.b}" x2="${W-P.r}" y2="${H-P.b}" stroke="var(--line)" stroke-width="1"/>
      ${rects}
      <line x1="${mX}" y1="${P.t+16}" x2="${mX}" y2="${H-P.b}" stroke="var(--navy)" stroke-width="1.8" stroke-dasharray="5 4" opacity=".65"/>
      <rect x="${mX-52}" y="${P.t-4}" width="104" height="20" rx="10" fill="var(--navy)"/>
      <text x="${mX}" y="${P.t+10}" text-anchor="middle" style="font-size:10px;font-weight:800;fill:#fff;letter-spacing:1px">MEDIANA · ${(mediana/365).toFixed(1)}a</text>
      <text x="${(W+P.l-P.r)/2}" y="${H-6}" text-anchor="middle" style="font-size:10px;fill:var(--muted);font-weight:700;letter-spacing:1px">FAIXA ETÁRIA →</text>
    </svg>`;

  // anima as barras crescendo (só as que têm data-anim-y — evita mexer na pill da mediana)
  setTimeout(()=>{
    const rects_el = document.querySelectorAll('#tempo-hist rect[data-anim-y]');
    rects_el.forEach((r,i)=>{
      setTimeout(()=>{
        r.style.transition = 'y .7s cubic-bezier(.22,1,.36,1), height .7s cubic-bezier(.22,1,.36,1)';
        r.setAttribute('y', r.dataset.animY);
        r.setAttribute('height', r.dataset.animH);
      }, i*90+40);
    });
  }, 60);

  // Legenda embaixo (compacta)
  document.getElementById('tempo-hist-legend').innerHTML =
    TEMPO_FAIXAS.map(f=>`<span class="thl-item"><span class="thl-dot" style="background:${f.hex}"></span>${f.label}</span>`).join('') +
    `<span class="thl-item"><span class="thl-dot" style="background:transparent;border-top:2px dashed var(--gold);border-radius:0"></span>Mediana do escritório</span>`;
}

// Filtro Tempo
function ativarFiltroTempo(){
  const inp = document.getElementById('tempo-filtro');
  const clr = document.getElementById('tempo-filtro-clear');
  if(!inp) return;
  const wrap = inp.parentElement;
  const atualizarWrap = ()=>wrap.classList.toggle('has', !!inp.value);
  const gs = ()=>GRUPOS.filter(g=>g.tramitDias>0);
  inp.addEventListener('input', ()=>{
    tempoFiltro = inp.value;
    atualizarWrap();
    _renderTempoRanking(gs());
  });
  clr.addEventListener('click', ()=>{
    inp.value=''; tempoFiltro=''; atualizarWrap();
    _renderTempoRanking(gs()); inp.focus();
  });
}

/* --- Bloco C: Polo processual --- */
// Estado para colapso/expansão + filtro
let poloExpandidoStack = false;
let poloFiltro = '';
const POLO_TOP = 15;
const PILHA_PREVIEW = 5;
const pilhaExpandida = {combativo:false, equilibrado:false, defensivo:false};

// classifica um grupo pelo perfil (combativo/equilibrado/defensivo) por % ativo
function _perfilPolo(g){
  if(g.pctAtivo >= 70) return 'combativo';
  if(g.pctAtivo <= 30) return 'defensivo';
  return 'equilibrado';
}

function renderPolo(){
  const gs = GRUPOS.filter(g=>g.polTot>0);
  if(!gs.length) return;

  // agregado do escritório (soma das contagens brutas — evita ponderar por grupo)
  const totAutor = gs.reduce((s,g)=>s+g.polAtivo,0);
  const totReu   = gs.reduce((s,g)=>s+g.polPassivo,0);
  const totTerc  = gs.reduce((s,g)=>s+g.polTerc,0);
  const totAll   = totAutor+totReu+totTerc || 1;

  _renderPoloMacro(totAutor, totReu, totTerc, totAll);
  _renderPoloDominante(gs, totAutor, totReu, totTerc, totAll);
  _renderPoloPilhas(gs);
  _renderPoloStack(gs);

  attachTT();
}

// A) Barra macro do escritório (uma só, empilhada, gigante)
function _renderPoloMacro(a, r, t, tot){
  const pA = a/tot*100, pR = r/tot*100, pT = t/tot*100;
  const el = document.getElementById('polo-macro');
  el.innerHTML = `
    <div class="polo-macro-seg mac-autor" style="width:0" data-w="${pA}" data-tt="<b>Autor (polo ativo)</b><br>${NUM(a)} processos · ${pA.toFixed(1)}%">
      ${pA>7?`<span>${pA.toFixed(0)}%<small>autor</small></span>`:''}
    </div>
    <div class="polo-macro-seg mac-reu" style="width:0" data-w="${pR}" data-tt="<b>Réu (polo passivo)</b><br>${NUM(r)} processos · ${pR.toFixed(1)}%">
      ${pR>7?`<span>${pR.toFixed(0)}%<small>réu</small></span>`:''}
    </div>
    <div class="polo-macro-seg mac-terc" style="width:0" data-w="${pT}" data-tt="<b>Terceiro / outros</b><br>${NUM(t)} processos · ${pT.toFixed(1)}%">
      ${pT>7?`<span>${pT.toFixed(0)}%<small>terc.</small></span>`:''}
    </div>`;
  setTimeout(()=>{
    el.querySelectorAll('.polo-macro-seg').forEach(s=>s.style.width = s.dataset.w+'%');
  }, 60);
  document.getElementById('polo-legend').innerHTML = `
    <div class="pl-item"><span class="pl-dot" style="background:linear-gradient(135deg,var(--polo-autor),var(--polo-autor-forte))"></span><span class="pl-lbl">Autor</span> <span class="pl-tag">polo ativo</span></div>
    <div class="pl-item"><span class="pl-dot" style="background:linear-gradient(135deg,var(--polo-reu),var(--polo-reu-forte))"></span><span class="pl-lbl">Réu</span> <span class="pl-tag">polo passivo</span></div>
    <div class="pl-item"><span class="pl-dot" style="background:linear-gradient(135deg,var(--polo-terc),var(--navy2))"></span><span class="pl-lbl">Terceiro</span> <span class="pl-tag">outros</span></div>`;
}

// B) Card 'Perfil dominante' (o que domina o escritório)
function _renderPoloDominante(gs, a, r, t, tot){
  const pA = a/tot*100, pR = r/tot*100, pT = t/tot*100;
  let head, lbl, sub;
  if(pR >= 55){
    head = pR.toFixed(1); lbl = 'Predominantemente defensivo';
    sub = `A carteira é majoritariamente reativa. Em ${pR.toFixed(1)}% dos processos o cliente figura como réu. A atuação se concentra em contenção de risco e defesa técnica.`;
  } else if(pA >= 55){
    head = pA.toFixed(1); lbl = 'Predominantemente ofensivo';
    sub = `A carteira é majoritariamente ativa. Em ${pA.toFixed(1)}% dos processos o cliente figura como autor. A atuação se concentra em recuperação e cobrança.`;
  } else {
    head = Math.max(pA,pR).toFixed(1); lbl = 'Perfil equilibrado';
    sub = `A carteira combina ações ofensivas e defensivas de forma equilibrada: ${pA.toFixed(0)}% como autor e ${pR.toFixed(0)}% como réu.`;
  }
  document.getElementById('polo-dom-head').innerHTML = `${head}<span style="font-size:22px;font-weight:700;color:var(--gold-soft);margin-left:2px">%</span><span class="pd-lbl">${lbl}</span>`;
  document.getElementById('polo-dom-sub').innerHTML = sub;
}

// C) 3 Pilhas colapsáveis (Combativos / Equilibrados / Defensivos)
function _renderPoloPilhas(gs){
  const por = {combativo:[], equilibrado:[], defensivo:[]};
  gs.forEach(g=>{ por[_perfilPolo(g)].push(g); });
  // ordena cada bucket por relevância
  por.combativo.sort((a,b)=>b.pctAtivo-a.pctAtivo || b.polTot-a.polTot);
  por.equilibrado.sort((a,b)=>b.polTot-a.polTot);
  por.defensivo.sort((a,b)=>a.pctAtivo-b.pctAtivo || b.polTot-a.polTot);

  ['combativo','equilibrado','defensivo'].forEach(k=>{
    const arr = por[k];
    const numEl = document.getElementById(`pilha-${k}-num`);
    const listEl = document.getElementById(`pilha-${k}-list`);
    const btn = document.getElementById(`pilha-${k}-toggle`);
    // count-up do número
    _tempoAnimarKpi(`pilha-${k}-num`, arr.length, v=>NUM(Math.round(v)));
    setTimeout(()=>{ numEl.innerHTML = `${NUM(arr.length)}<small> grupos</small>`; }, 950);

    const preview = pilhaExpandida[k] ? arr.length : Math.min(PILHA_PREVIEW, arr.length);
    const rows = arr.slice(0, preview);
    listEl.innerHTML = rows.length ? rows.map(g=>{
      const pA = g.pctAtivo, pR = g.pctPassivo;
      const info = k==='combativo' ? `${pA.toFixed(0)}% autor` : k==='defensivo' ? `${pR.toFixed(0)}% réu` : `${pA.toFixed(0)}% / ${pR.toFixed(0)}%`;
      return `<div class="pc-list-row" data-tt="<b>${g.nome}</b><br>Autor: ${g.polAtivo} (${pA.toFixed(0)}%)<br>Réu: ${g.polPassivo} (${pR.toFixed(0)}%)<br>${g.polTot} processos total">
        <div class="lbl">${g.nome.replace(/^Grupo\s+/,'')}</div>
        <div class="val">${info}</div>
      </div>`;
    }).join('') : `<div style="padding:12px 8px;color:var(--muted);font-size:11.5px;font-style:italic">Nenhum grupo neste perfil.</div>`;

    if(arr.length > PILHA_PREVIEW){
      btn.classList.remove('oculto');
      btn.textContent = pilhaExpandida[k] ? `Recolher (mostrar top ${PILHA_PREVIEW})` : `Ver todos os ${arr.length}`;
      btn.onclick = ()=>{ pilhaExpandida[k] = !pilhaExpandida[k]; _renderPoloPilhas(gs); };
    } else {
      btn.classList.add('oculto');
    }
  });
}

// D) Ranking detalhado (stack) com filtro e ver todos
function _renderPoloStack(gs){
  const q = poloFiltro.trim().toLowerCase();
  const filtrados = q ? gs.filter(g=>g.nome.toLowerCase().includes(q)) : gs;
  const ordenados = [...filtrados].sort((a,b)=>b.pctAtivo-a.pctAtivo);
  const limite = (poloExpandidoStack || q) ? ordenados.length : Math.min(POLO_TOP, ordenados.length);
  const rows = ordenados.slice(0, limite);

  const container = document.getElementById('polo-stack');
  container.innerHTML = rows.length ? rows.map((g,i)=>{
    const pA = g.pctAtivo, pP = g.pctPassivo, pT = 100-pA-pP;
    const podium = i===0?' top1':i===1?' top2':i===2?' top3':'';
    return `<div class="stack-row${podium}" style="animation-delay:${Math.min(i*30,500)}ms" data-tt="<b>${g.nome}</b><br>Autor: ${g.polAtivo} (${pA.toFixed(0)}%)<br>Réu: ${g.polPassivo} (${pP.toFixed(0)}%)<br>Terceiro: ${g.polTerc} (${pT.toFixed(0)}%)">
      <div class="name" title="${g.nome}">${g.nome.replace(/^Grupo\s+/,'')}</div>
      <div class="stack-bar">
        <span style="width:0;background:linear-gradient(90deg,var(--polo-autor),var(--polo-autor-forte))" data-w="${pA}"></span>
        <span style="width:0;background:linear-gradient(90deg,var(--polo-reu),var(--polo-reu-forte))" data-w="${pP}"></span>
        <span style="width:0;background:linear-gradient(90deg,var(--polo-terc),var(--navy2))" data-w="${pT}"></span>
      </div>
      <div class="tot">${g.polTot}</div>
    </div>`;
  }).join('') : `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">Nenhum grupo encontrado${q?' com esse filtro':''}.</div>`;
  // anima as larguras
  setTimeout(()=>{
    container.querySelectorAll('.stack-row .stack-bar span').forEach(sp=>sp.style.width = sp.dataset.w+'%');
  }, 100);

  const footer = container.parentElement.querySelector('.rank-footer');
  const btn = document.getElementById('polo-expand');
  if(!q && ordenados.length > POLO_TOP){
    footer.style.display='flex';
    btn.textContent = poloExpandidoStack ? `Recolher (voltar ao top ${POLO_TOP})` : `Ver todos os ${ordenados.length} grupos`;
    btn.onclick = ()=>{ poloExpandidoStack = !poloExpandidoStack; _renderPoloStack(gs); };
  } else {
    footer.style.display='none';
  }
  attachTT();
}

// Filtro Polo
function ativarFiltroPolo(){
  const inp = document.getElementById('polo-filtro');
  const clr = document.getElementById('polo-filtro-clear');
  if(!inp) return;
  const wrap = inp.parentElement;
  const atualizarWrap = ()=>wrap.classList.toggle('has', !!inp.value);
  const gs = ()=>GRUPOS.filter(g=>g.polTot>0);
  inp.addEventListener('input', ()=>{
    poloFiltro = inp.value;
    atualizarWrap();
    _renderPoloStack(gs());
  });
  clr.addEventListener('click', ()=>{
    inp.value=''; poloFiltro=''; atualizarWrap();
    _renderPoloStack(gs()); inp.focus();
  });
}

/* --- Bloco D: Partes contrárias recorrentes --- */
// Categoriza um adversário pelo nome (heurística por regex).
// Retorna {cls, tag, label} — cls é a classe CSS do pill.
function _tipoAdversario(nome){
  const s = String(nome||'').toUpperCase();
  // ordem importa: mais específico primeiro
  if(/^MUNIC[IÍ]PIO|PREFEITURA/i.test(s)) return {cls:'t-mun', tag:'MUNICÍPIO', label:'Municípios'};
  if(/^ESTADO DE|GOVERNO DO ESTADO|SECRETARIA (DA|DE) FAZENDA|FAZENDA (ESTADUAL|DO ESTADO)|DEPARTAMENTO (DE|DA) ESTADO/i.test(s)) return {cls:'t-uf', tag:'ESTADO', label:'Estados'};
  if(/^UNI[AÃ]O|INSS|FAZENDA NACIONAL|RECEITA FEDERAL|IBAMA|ANATEL|ANEEL|ANVISA|MINIST[EÉ]RIO P[UÚ]BLICO|MPF|MPT|CAIXA ECON[OÔ]MICA|BANCO CENTRAL/i.test(s)) return {cls:'t-un', tag:'UNIÃO', label:'União / autarquias'};
  if(/BANCO |BRADESCO|ITA[UÚ]|SANTANDER|BANRISUL|BB S\.?A\.?|CEF|CAIXA S\.?A|FINANCEIRA|SICOOB|SICREDI/i.test(s)) return {cls:'t-bnc', tag:'BANCO', label:'Bancos'};
  if(/LTDA|S\.?A\.?$| S\.?A\.? |INC\.|COMP|CORP|SOCIEDADE|EIRELI|MEI|CONSTRUTORA|INCORPORADORA|EMPREENDIMENTOS|LOJAS|LOG[IÍ]STICA|SEGURADORA|SEGUROS|IND[UÚ]STRIA|COM[EÉ]RCIO|COMERCIAL|SERVI[CÇ]OS/i.test(s)) return {cls:'t-emp', tag:'EMPRESA', label:'Empresas privadas'};
  // heurística pessoa física: 2-4 palavras curtas, todas com inicial maiúscula em capitalização original
  const original = String(nome||'');
  const palavras = original.split(/\s+/).filter(w=>w.length>1);
  if(palavras.length>=2 && palavras.length<=5 && palavras.every(p=>/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç'-]*$/.test(p) || /^[A-Z]\.?$/.test(p))) return {cls:'t-pf', tag:'PESSOA FÍSICA', label:'Pessoas físicas'};
  return {cls:'t-out', tag:'OUTROS', label:'Outros'};
}

let partesExpandido = false;
let partesFiltro = '';
const PARTES_TOP = 12;

function renderPartes(){
  // agrega o ranking de todos os grupos
  const agg = new Map();
  GRUPOS.forEach(g=>{
    (g.ranking||[]).forEach(([nome, qtd])=>{
      if(!nome) return;
      const k = String(nome).trim().toUpperCase();
      const cur = agg.get(k) || {nome:nome, qtd:0, grupos:new Set()};
      cur.qtd += qtd;
      cur.grupos.add(g.nome);
      agg.set(k, cur);
    });
  });
  const todos = [...agg.values()].sort((a,b)=>b.qtd-a.qtd);
  const totalProcs = todos.reduce((s,r)=>s+r.qtd,0)||1;

  // classifica cada adversário
  todos.forEach(r=>{ r.tipo = _tipoAdversario(r.nome); });

  // Estatísticas — perfil dominante (ignora 'Outros' para o KPI ficar informativo)
  const perQtd = {};
  todos.forEach(r=>{ perQtd[r.tipo.label] = (perQtd[r.tipo.label]||0)+r.qtd; });
  const perOrd = Object.entries(perQtd).sort((a,b)=>b[1]-a[1]);
  const perOrdCat = perOrd.filter(([k])=>k!=='Outros');
  const perTop = perOrdCat[0] || perOrd[0] || ['sem registro',0];

  // Descrição executiva
  document.getElementById('partes-desc').innerHTML =
    `<b>${NUM(todos.length)}</b> partes distintas figuram como adversárias do escritório. A concentração no topo indica litígio de massa ou disputa recorrente. A categoria do adversário mostra o tipo de contencioso mais frequente.`;

  // KPIs
  _tempoAnimarKpi('pt-unicos', todos.length, v=>NUM(Math.round(v)));
  document.getElementById('pt-unicos-sub').innerHTML = `em <b>${NUM(GRUPOS.filter(g=>(g.ranking||[]).length).length)}</b> grupos`;
  const top10 = todos.slice(0,10);
  const top10Qtd = top10.reduce((s,r)=>s+r.qtd,0);
  const concPct = top10Qtd/totalProcs*100;
  _tempoAnimarKpi('pt-conc', concPct, v=>v.toFixed(1));
  const pctPerfil = (perTop[1]/totalProcs*100);
  const perfilEl = document.getElementById('pt-perfil-num');
  perfilEl.textContent = perTop[0];
  document.getElementById('pt-perfil-desc').innerHTML = `<b>${pctPerfil.toFixed(1)}%</b> dos processos do top 10 são contra <b>${perTop[0].toLowerCase()}</b>`;

  // Card líder
  const lider = todos[0];
  if(lider){
    document.getElementById('pt-lider-nome').innerHTML =
      `<span class="pl-num">${NUM(lider.qtd)}</span><span>processos contra<br><b style="color:#fff">${lider.nome}</b></span>`;
    const pctLider = (lider.qtd/totalProcs*100).toFixed(1);
    document.getElementById('pt-lider-sub').innerHTML =
      `Concentra <b>${pctLider}%</b> dos processos com adversário identificado. Aparece em <b>${lider.grupos.size} grupo${lider.grupos.size>1?'s':''}</b> do escritório.`;
    const gruposTop = [...lider.grupos].slice(0,4);
    document.getElementById('pt-lider-list').innerHTML = gruposTop.map(gn=>`
      <div class="pl-item"><span class="lbl">${gn.replace(/^Grupo\s+/,'')}</span></div>`).join('') +
      (lider.grupos.size>4 ? `<div class="pl-item"><span class="lbl" style="font-style:italic">+ ${lider.grupos.size-4} outros grupos</span></div>`:'');
  }

  _renderPartesRanking(todos, totalProcs);
  attachTT();
}

function _renderPartesRanking(todos, totalProcs){
  const q = partesFiltro.trim().toLowerCase();
  const filtrados = q ? todos.filter(r=>r.nome.toLowerCase().includes(q)) : todos;
  const limite = (partesExpandido || q) ? filtrados.length : Math.min(PARTES_TOP, filtrados.length);
  const rows = filtrados.slice(0, limite);
  const max = Math.max(...rows.map(r=>r.qtd),1);
  const container = document.getElementById('partes-top');
  container.innerHTML = rows.length ? rows.map((r,i)=>{
    const pct = r.qtd/max*100;
    const gs = [...r.grupos].slice(0,6).map(gn=>gn.replace(/^Grupo\s+/,'')).join(', ');
    const mais = r.grupos.size>6 ? ` +${r.grupos.size-6}` : '';
    const podium = i===0?' top1':i===1?' top2':i===2?' top3':'';
    return `<div class="bar-row${podium}" style="animation-delay:${Math.min(i*35,600)}ms" data-tt="<b>${r.nome}</b><br>${NUM(r.qtd)} processos · ${(r.qtd/totalProcs*100).toFixed(1)}% do total<br>Em ${r.grupos.size} grupo(s): <i>${gs}${mais}</i>">
      <div class="name">
        <span class="rk-badge">${i+1}</span>
        <span class="adv-nome" title="${r.nome}">${r.nome}</span>
        <span class="adv-tipo ${r.tipo.cls}">${r.tipo.tag}</span>
      </div>
      <div class="bar-track"><div class="bar-fill gold" style="width:0" data-w="${pct}" data-v="${r.qtd}"></div></div>
      <div class="val"><span class="v-num" data-final="${r.qtd}">0</span><small>${r.grupos.size} grupo${r.grupos.size>1?'s':''}</small></div>
    </div>`;
  }).join('') : `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">Nenhum adversário encontrado${q?' com esse filtro':''}.</div>`;

  // anima barras + count-up
  setTimeout(()=>{
    container.querySelectorAll('.bar-row').forEach((row,i)=>{
      const fill = row.querySelector('.bar-fill'), vNum = row.querySelector('.v-num');
      if(!fill||!vNum) return;
      const alvo = +fill.dataset.v;
      setTimeout(()=>{
        fill.style.width = fill.dataset.w+'%';
        fill.classList.add('go');
        const dur=850, passos=28; let k=0;
        const iv = setInterval(()=>{
          k++;
          const p=k/passos, e=1-Math.pow(1-p,5);
          if(k<passos) vNum.textContent = NUM(Math.round(alvo*e));
          else { vNum.textContent = NUM(alvo); clearInterval(iv); }
        }, dur/passos);
      }, Math.min(i*35,600)+40);
    });
  }, 30);

  const footer = container.parentElement.querySelector('.rank-footer');
  const btn = document.getElementById('partes-expand');
  if(!q && filtrados.length > PARTES_TOP){
    footer.style.display='flex';
    btn.textContent = partesExpandido ? `Recolher (voltar ao top ${PARTES_TOP})` : `Ver todos os ${filtrados.length} adversários`;
    btn.onclick = ()=>{ partesExpandido = !partesExpandido; _renderPartesRanking(todos, totalProcs); };
  } else {
    footer.style.display='none';
  }
  attachTT();
}

function ativarFiltroPartes(){
  const inp = document.getElementById('partes-filtro');
  const clr = document.getElementById('partes-filtro-clear');
  if(!inp) return;
  const wrap = inp.parentElement;
  const atualizarWrap = ()=>wrap.classList.toggle('has', !!inp.value);
  const recalcular = ()=>{
    // reaproveita a agregação chamando renderPartes por completo é caro; refaz só o ranking
    const agg = new Map();
    GRUPOS.forEach(g=>{
      (g.ranking||[]).forEach(([nome, qtd])=>{
        if(!nome) return;
        const k = String(nome).trim().toUpperCase();
        const cur = agg.get(k) || {nome:nome, qtd:0, grupos:new Set()};
        cur.qtd += qtd; cur.grupos.add(g.nome);
        agg.set(k, cur);
      });
    });
    const todos = [...agg.values()].sort((a,b)=>b.qtd-a.qtd);
    todos.forEach(r=>{ r.tipo = _tipoAdversario(r.nome); });
    _renderPartesRanking(todos, todos.reduce((s,r)=>s+r.qtd,0)||1);
  };
  inp.addEventListener('input', ()=>{
    partesFiltro = inp.value;
    atualizarWrap();
    recalcular();
  });
  clr.addEventListener('click', ()=>{
    inp.value=''; partesFiltro=''; atualizarWrap();
    recalcular(); inp.focus();
  });
}

/* --- Bloco A/F: Séries anuais (entradas × encerramentos) --- */
function renderSeries(){
  // agrega por ano
  const ent={}, enc={}, extra={};
  GRUPOS.forEach(g=>{
    Object.entries(g.entradasAno).forEach(([a,v])=>ent[a]=(ent[a]||0)+v);
    Object.entries(g.encerradosAno).forEach(([a,v])=>enc[a]=(enc[a]||0)+v);
    Object.entries(g.extraAno).forEach(([a,v])=>extra[a]=(extra[a]||0)+v);
  });
  const anos = [...new Set([...Object.keys(ent),...Object.keys(enc)])].filter(a=>+a>=2020&&+a<=2026).sort();
  if(!anos.length) return;

  // Ano de referência = último ano cheio (2025 se dashboard rodou em 2026)
  const ANO_CORRENTE = 2026;
  const ANO_REF = 2025;
  const anoCorrenteIdx = anos.indexOf(String(ANO_CORRENTE));

  // Ano corrente é PARCIAL — os dados vão até a data-corte 24/07/2026 (~6,8 meses).
  // Não fazemos projeção linear — é mais honesto mostrar como parcial explicitamente.
  const DATA_CORTE_TXT = 'até 24/07';

  // === KPIs ===
  const entRef = ent[String(ANO_REF)]||0;
  const encRef = enc[String(ANO_REF)]||0;
  const saldoRef = entRef - encRef;
  _tempoAnimarKpi('mov-num-ent', entRef, v=>NUM(Math.round(v)));
  _tempoAnimarKpi('mov-num-enc', encRef, v=>NUM(Math.round(v)));
  // saldo com sinal e classe
  const sldKpi = document.getElementById('mov-kpi-saldo');
  const sldEl = document.getElementById('mov-num-saldo');
  sldKpi.classList.remove('pos','neg','neu');
  if(saldoRef > 20) sldKpi.classList.add('pos');
  else if(saldoRef < -20) sldKpi.classList.add('neg');
  else sldKpi.classList.add('neu');
  const sinalKpi = saldoRef > 0 ? '+' : saldoRef < 0 ? '−' : '';
  {
    const dur=900, passos=32; let k=0;
    const abs = Math.abs(saldoRef);
    const iv = setInterval(()=>{
      k++;
      const p=k/passos, e=1-Math.pow(1-p,5);
      sldEl.textContent = sinalKpi + NUM(Math.round(abs*e));
      if(k>=passos){ sldEl.textContent = sinalKpi + NUM(abs); clearInterval(iv); }
    }, dur/passos);
  }
  document.getElementById('mov-desc-saldo').innerHTML =
    saldoRef > 0 ? `carteira <b style="color:#2f7a44">cresceu</b> em ${NUM(saldoRef)} processos` :
    saldoRef < 0 ? `carteira <b style="color:#a63d38">encolheu</b> em ${NUM(Math.abs(saldoRef))} processos` :
    `carteira <b>estabilizada</b>`;

  // Taxa de encerramento — últimos 5 anos (excluindo o corrente parcial)
  const janela = anos.filter(a=>+a>=ANO_REF-4 && +a<=ANO_REF);
  const totEnt5 = janela.reduce((s,a)=>s+(ent[a]||0),0);
  const totEnc5 = janela.reduce((s,a)=>s+(enc[a]||0),0);
  const taxaEnc = totEnt5 ? (totEnc5/totEnt5*100) : 0;
  _tempoAnimarKpi('mov-num-tx', taxaEnc, v=>v.toFixed(1));
  document.getElementById('mov-tx-anos').textContent = `${janela[0]} a ${janela[janela.length-1]}`;

  // === Diagnóstico ===
  // Analisa os últimos 3 anos cheios para tendência
  const janela3 = [ANO_REF-2, ANO_REF-1, ANO_REF].map(a=>String(a));
  const saldos3 = janela3.map(a=>(ent[a]||0)-(enc[a]||0));
  const somaSaldo3 = saldos3.reduce((s,v)=>s+v,0);
  const cresceu3 = saldos3.filter(v=>v>0).length;

  // Crescimento entradas ano ref vs ano ref-1
  const entPrev = ent[String(ANO_REF-1)]||0;
  const growthEntPct = entPrev ? ((entRef-entPrev)/entPrev*100) : 0;

  let head, sub;
  if(somaSaldo3 > 50 || cresceu3 >= 2){
    head = `<span class="md-num">+${NUM(somaSaldo3)}</span>Carteira em expansão`;
    sub = `Nos últimos 3 anos cheios (${ANO_REF-2} a ${ANO_REF}), a carteira ganhou <b>${NUM(somaSaldo3)} processos</b> líquidos.` +
          (growthEntPct >= 5 ? ` Entradas aceleraram <b>${growthEntPct.toFixed(1)}%</b> de ${ANO_REF-1} para ${ANO_REF}, indicando maior contencioso a absorver.` :
           ` A capacidade de encerramento de ${taxaEnc.toFixed(1)}% ainda não acompanha o volume de novos casos.`);
  } else if(somaSaldo3 < -50 || cresceu3 <= 1){
    head = `<span class="md-num">${somaSaldo3>=0?'+':''}${NUM(somaSaldo3)}</span>Carteira em contração`;
    sub = `Nos últimos 3 anos cheios (${ANO_REF-2}–${ANO_REF}), a carteira encolheu em <b>${NUM(Math.abs(somaSaldo3))} processos</b> líquidos.` +
          ` Taxa de encerramento de <b>${taxaEnc.toFixed(1)}%</b> superior ao ritmo de entradas. Desmobilização em curso.`;
  } else {
    head = `<span class="md-num">${somaSaldo3>=0?'+':''}${NUM(somaSaldo3)}</span>Carteira estável`;
    sub = `Nos últimos 3 anos cheios (${ANO_REF-2}–${ANO_REF}), entradas e encerramentos rodam próximos do equilíbrio (saldo líquido de <b>${NUM(somaSaldo3)}</b> processos). Estoque em regime de manutenção.`;
  }
  document.getElementById('mov-diag-head').innerHTML = head;
  document.getElementById('mov-diag-sub').innerHTML = sub;

  // === Gráfico principal ===
  // Estoque acumulado (soma cumulativa dos saldos anuais). Começa em 0 no ano inicial.
  // Interpretação: onde estava o estoque acumulado a partir da série disponível.
  // Para incluir base, começamos em 0 e somamos os saldos ano a ano.
  let est = 0;
  const estoque = {};
  anos.forEach(a=>{
    const s = (ent[a]||0) - (enc[a]||0);
    est += s;
    estoque[a] = est;
  });

  const maxY = Math.max(
    ...anos.map(a=>Math.max(ent[a]||0, enc[a]||0)),
    1
  );
  // estoque pode ficar negativo em algum ano; ajustamos a escala secundária
  const estMin = Math.min(0, ...Object.values(estoque));
  const estMax = Math.max(0, ...Object.values(estoque));
  const estRange = Math.max(estMax - estMin, 1);

  const W=1040, H=400, P={l:66,r:80,t:44,b:74};
  const bw = (W-P.l-P.r) / anos.length;
  const y = v => H-P.b - v/maxY*(H-P.t-P.b);
  const yEst = v => H-P.b - (v-estMin)/estRange*(H-P.t-P.b);
  const x = i => P.l + i*bw + bw/2;

  // --- grid ---
  let grid='';
  for(let i=0;i<=4;i++){
    const v = Math.round(maxY*i/4);
    grid += `<line x1="${P.l}" y1="${y(v)}" x2="${W-P.r}" y2="${y(v)}" stroke="var(--line)" opacity=".55"/>`;
    grid += `<text x="${P.l-8}" y="${y(v)+3}" text-anchor="end" style="font-size:10.5px;fill:var(--muted2);font-weight:700;font-variant-numeric:tabular-nums">${NUM(v)}</text>`;
  }
  // rótulo eixo Y esquerdo
  grid += `<text transform="rotate(-90 22 ${(H-P.b+P.t)/2})" x="22" y="${(H-P.b+P.t)/2}" text-anchor="middle" style="font-size:10px;fill:var(--muted);font-weight:800;letter-spacing:1.6px">MOVIMENTO ANUAL</text>`;
  // eixo Y direito (variação acumulada) — ticks discretos, DENTRO do viewBox
  const nTicksEst = 4;
  for(let i=0;i<=nTicksEst;i++){
    const v = Math.round(estMin + (estRange*i/nTicksEst));
    grid += `<text x="${W-P.r+8}" y="${yEst(v)+3}" text-anchor="start" style="font-size:10.5px;fill:var(--gold);font-weight:700;font-variant-numeric:tabular-nums">${v>=0?'+':''}${NUM(v)}</text>`;
  }
  grid += `<text transform="rotate(90 ${W-16} ${(H-P.b+P.t)/2})" x="${W-16}" y="${(H-P.b+P.t)/2}" text-anchor="middle" style="font-size:10px;fill:var(--gold);font-weight:800;letter-spacing:1.6px">VARIAÇÃO ACUMULADA</text>`;

  // --- área de estoque acumulado ---
  // pontos: (x_i, yEst(estoque_i)) + baseline em yEst(0)
  const yZero = yEst(0);
  const estPts = anos.map((a,i)=>[x(i), yEst(estoque[a])]);
  const areaPath = estPts.length ?
    `M ${estPts[0][0]},${yZero} ` +
    estPts.map(p=>`L ${p[0]},${p[1]}`).join(' ') +
    ` L ${estPts[estPts.length-1][0]},${yZero} Z` : '';
  const linePath = estPts.length ?
    `M ${estPts[0][0]},${estPts[0][1]} ` + estPts.slice(1).map(p=>`L ${p[0]},${p[1]}`).join(' ') : '';

  const defs = `
    <defs>
      <linearGradient id="grad-estoque" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgb(181,134,66)" stop-opacity="0.75"/>
        <stop offset="70%" stop-color="rgb(181,134,66)" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="rgb(181,134,66)" stop-opacity="0.02"/>
      </linearGradient>
      <linearGradient id="grad-bar-ent" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#CFA36E"/><stop offset="100%" stop-color="#B58642"/>
      </linearGradient>
      <linearGradient id="grad-bar-enc" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5b6a94"/><stop offset="100%" stop-color="#1E223F"/>
      </linearGradient>
      <linearGradient id="grad-sweep" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(181,134,66,0)"/>
        <stop offset="50%" stop-color="rgba(181,134,66,0.65)"/>
        <stop offset="100%" stop-color="rgba(181,134,66,0)"/>
      </linearGradient>
      <filter id="glow-est" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

  // linha de varredura (SVG animateTransform)
  const sweep = `
    <g class="mov-sweep">
      <rect x="${P.l}" y="${P.t}" width="24" height="${H-P.t-P.b}" fill="url(#grad-sweep)">
        <animate attributeName="x" from="${P.l}" to="${W-P.r-24}" dur="1.6s" begin=".5s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>
      </rect>
    </g>`;

  const areaHtml = `
    <path class="mov-area" d="${areaPath}" fill="url(#grad-estoque)" opacity="0"/>
    <path class="mov-line" d="${linePath}" fill="none" stroke="rgb(181,134,66)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0" filter="url(#glow-est)"/>
  `;

  // --- barras (entradas + encerramentos) ---
  const barW = Math.min(24, bw*0.28);
  let bars='';
  anos.forEach((a,i)=>{
    const cx = x(i);
    const e = ent[a]||0, f = enc[a]||0;
    const isParcial = +a === ANO_CORRENTE;
    const suf = isParcial ? ` <i>(parcial)</i>` : '';
    // opacidade suave nas barras do ano parcial para diferenciar visualmente
    const opacBar = isParcial ? '.68' : '1';
    // barra real de entrada
    const yE = y(e); const hE = H-P.b - yE;
    bars += `<rect class="mov-bar mov-bar-ent${isParcial?' mov-parcial':''}" x="${cx-barW-3}" y="${H-P.b}" width="${barW}" height="0"
      data-anim-y="${yE}" data-anim-h="${hE}"
      fill="url(#grad-bar-ent)" fill-opacity="${opacBar}" rx="3" data-tt="<b>${a} · Entradas</b><br>${NUM(e)} processos${suf}"/>`;
    // barra real de encerramento
    const yF = y(f); const hF = H-P.b - yF;
    bars += `<rect class="mov-bar mov-bar-enc${isParcial?' mov-parcial':''}" x="${cx+3}" y="${H-P.b}" width="${barW}" height="0"
      data-anim-y="${yF}" data-anim-h="${hF}"
      fill="url(#grad-bar-enc)" fill-opacity="${opacBar}" rx="3" data-tt="<b>${a} · Encerramentos</b><br>${NUM(f)} processos${suf}"/>`;
    // rótulos números em cima
    bars += `<text x="${cx-barW/2-3}" y="${yE-6}" text-anchor="middle" style="font-size:10px;fill:var(--gold-line);font-weight:800;font-variant-numeric:tabular-nums">${NUM(e)}</text>`;
    bars += `<text x="${cx+barW/2+3}" y="${yF-6}" text-anchor="middle" style="font-size:10px;fill:var(--navy);font-weight:800;font-variant-numeric:tabular-nums">${NUM(f)}</text>`;
    // rótulo do ano embaixo — marca o ano parcial
    bars += `<text x="${cx}" y="${H-P.b+18}" text-anchor="middle" style="font-size:12px;fill:${isParcial?'var(--muted)':'var(--navy)'};font-weight:800;letter-spacing:.4px">${a}${isParcial?' (parcial)':''}</text>`;
    // pastilha de delta (usa foreignObject para ficar centralizada)
    const delta = e-f;
    const dSinal = delta>0?'+':delta<0?'−':'';
    const dCls = delta>20?'pos':delta<-20?'neg':'neu';
    const badgeW = 62, badgeH = 20;
    bars += `<foreignObject x="${cx-badgeW/2}" y="${H-P.b+28}" width="${badgeW}" height="${badgeH}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;justify-content:center;pointer-events:none">
        <span class="mov-delta ${dCls}" data-final="${Math.abs(delta)}" data-sinal="${dSinal}" style="animation-delay:${900 + i*80}ms">${dSinal}0</span>
      </div>
    </foreignObject>`;
  });

  // Marcadores das linhas do estoque (dots dourados)
  const estDots = anos.map((a,i)=>`
    <circle class="mov-est-dot" cx="${x(i)}" cy="${yEst(estoque[a])}" r="0" fill="#B58642" stroke="#fff" stroke-width="2"
      data-final-r="4.5" data-tt="<b>${a} · Variação acumulada</b><br>${estoque[a]>=0?'+':''}${NUM(estoque[a])} processos"/>`).join('');

  document.getElementById('mov-chart').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${defs}
      ${grid}
      ${areaHtml}
      ${bars}
      ${estDots}
      ${sweep}
    </svg>`;

  // Legenda + badge do ano parcial
  const badge = document.getElementById('mov-badge-live');
  badge.textContent = anoCorrenteIdx>=0 ? `${ANO_CORRENTE} parcial` : '';
  document.getElementById('mov-legend').innerHTML = `
    <div class="ml-item"><span class="ml-swatch entradas"></span><span class="ml-lbl">Entradas</span></div>
    <div class="ml-item"><span class="ml-swatch encerr"></span><span class="ml-lbl">Encerramentos</span></div>
    <div class="ml-item"><span class="ml-swatch estoque"></span><span class="ml-lbl">Variação acumulada <small>desde ${anos[0]}</small></span></div>
    <div class="ml-item ml-item-note">
      <span class="ml-swatch parcial"></span>
      <span class="ml-lbl">${ANO_CORRENTE} parcial <small>ano em curso. Não representa o ano fechado.</small></span>
    </div>`;

  // Anima barras + área + dots
  setTimeout(()=>{
    // barras crescem
    const rects = document.querySelectorAll('#mov-chart .mov-bar:not(.mov-bar-proj)');
    rects.forEach((r,i)=>{
      setTimeout(()=>{
        r.style.transition = 'y .75s cubic-bezier(.22,1,.36,1), height .75s cubic-bezier(.22,1,.36,1)';
        r.setAttribute('y', r.dataset.animY);
        r.setAttribute('height', r.dataset.animH);
      }, i*50);
    });
    // área e linha entram por opacidade
    const area = document.querySelector('#mov-chart .mov-area');
    const line = document.querySelector('#mov-chart .mov-line');
    if(area) setTimeout(()=>{ area.style.transition = 'opacity .8s ease-out'; area.style.opacity = '1'; }, rects.length*50 + 200);
    if(line) setTimeout(()=>{ line.style.transition = 'opacity .8s ease-out'; line.style.opacity = '1'; }, rects.length*50 + 400);
    // dots do estoque
    setTimeout(()=>{
      document.querySelectorAll('#mov-chart .mov-est-dot').forEach((d,i)=>{
        setTimeout(()=>{
          d.style.transition = 'r .4s cubic-bezier(.22,1,.36,1)';
          d.setAttribute('r', d.dataset.finalR);
        }, i*60);
      });
    }, rects.length*50 + 500);
    // count-up dos deltas nas pastilhas
    document.querySelectorAll('#mov-chart .mov-delta').forEach((el,i)=>{
      const alvo = +el.dataset.final;
      const sinal = el.dataset.sinal;
      setTimeout(()=>{
        const dur=800, passos=26; let k=0;
        const iv = setInterval(()=>{
          k++;
          const p=k/passos, e=1-Math.pow(1-p,5);
          if(k<passos) el.textContent = sinal + NUM(Math.round(alvo*e));
          else { el.textContent = sinal + NUM(alvo); clearInterval(iv); }
        }, dur/passos);
      }, 950 + i*80);
    });
  }, 60);

  // === Extrajudicial ===
  const anosExtra = anos.filter(a=>extra[a]>0);
  const maxExtra = Math.max(...anosExtra.map(a=>extra[a]),1);
  const contExtra = document.getElementById('mov-extra');
  if(anosExtra.length){
    contExtra.innerHTML = anosExtra.map(a=>{
      const v = extra[a];
      const pct = v/maxExtra*100;
      return `<div class="mov-extra-row" data-tt="<b>${a}</b><br>${NUM(v)} atuações extrajudiciais">
        <div class="fx-name">${a}</div>
        <div class="fx-track"><div class="fx-fill" style="width:0" data-w="${pct}"></div></div>
        <div class="fx-val">${NUM(v)}</div>
      </div>`;
    }).join('');
    setTimeout(()=>{
      contExtra.querySelectorAll('.fx-fill').forEach((f,i)=>{
        setTimeout(()=>f.style.width=f.dataset.w+'%', i*80+120);
      });
    }, 60);
    const totExtra = anosExtra.reduce((s,a)=>s+extra[a],0);
    document.getElementById('mov-extra-note').innerHTML = `<b>${NUM(totExtra)}</b> atuações extrajudiciais acumuladas no período. Contempla negociações, notificações e composições, complementando o contencioso judicial.`;
  } else {
    document.getElementById('mov-extra-panel').style.display='none';
  }

  attachTT();
}

/* ====================== Tooltip ====================== */
const tt=document.getElementById('tt');
function attachTT(){
  document.querySelectorAll('[data-tt]').forEach(el=>{
    el.onmousemove=e=>{tt.innerHTML=el.dataset.tt;tt.classList.add('on');
      tt.style.left=Math.min(e.clientX+14,innerWidth-230)+'px';tt.style.top=(e.clientY+14)+'px';};
    el.onmouseleave=()=>tt.classList.remove('on');
  });
}

carregar();
