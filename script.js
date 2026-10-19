/* ============================================================
   Jogo da Cobrinha  —  script.js
   ------------------------------------------------------------
   Como funciona: o jogo anda em "passos" (células da grade) e o
   desenho é interpolado entre um passo e outro para o movimento
   ficar suave. Tudo em um só arquivo, sem bibliotecas.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Configurações (mexa aqui para ajustar o jogo) ---------- */
  const COLUNAS = 20;          // quantidade de células na horizontal
  const LINHAS = 20;           // quantidade de células na vertical
  const TAMANHO = 600;         // tamanho lógico do canvas em pixels
  const VELOCIDADE_INICIAL = 145; // ms entre cada passo (menor = mais rápido)
  const VELOCIDADE_MINIMA = 70;   // limite de velocidade
  const ACELERACAO = 4;           // ms que acelera a cada ponto
  const CHAVE_RECORDE = "cobrinha-recorde";

  /* ---------- Elementos da página ---------- */
  const canvas = document.getElementById("tela");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const elPontos = document.getElementById("pontos");
  const elRecorde = document.getElementById("recorde");
  const elOverlay = document.getElementById("overlay");
  const elTitulo = document.getElementById("overlay-titulo");
  const elTexto = document.getElementById("overlay-texto");
  const elAcao = document.getElementById("btn-acao");
  const elPausar = document.getElementById("btn-pausar");

  const CELULA = TAMANHO / COLUNAS;

  /* ---------- Nitidez em telas retina ---------- */
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = TAMANHO * dpr;
  canvas.height = TAMANHO * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* ---------- Estado do jogo ---------- */
  const DIRECOES = {
    cima: { x: 0, y: -1 },
    baixo: { x: 0, y: 1 },
    esquerda: { x: -1, y: 0 },
    direita: { x: 1, y: 0 },
  };

  let estado = "pronto"; // "pronto" | "rodando" | "pausado" | "fim"
  let cobra = [];        // [{x, y}] — o índice 0 é a cabeça
  let anterior = [];     // posições do passo anterior (para a interpolação)
  let direcao = DIRECOES.direita;
  let fila = [];         // até 2 comandos guardados para não perder toques rápidos
  let comida = { x: 10, y: 10 };
  let pontos = 0;
  let recorde = 0;
  let acumulado = 0;
  let ultimoTempo = 0;

  try {
    recorde = parseInt(localStorage.getItem(CHAVE_RECORDE) || "0", 10) || 0;
  } catch (e) {
    recorde = 0;
  }
  if (elRecorde) elRecorde.textContent = recorde;

  const passoAtual = () =>
    Math.max(VELOCIDADE_MINIMA, VELOCIDADE_INICIAL - pontos * ACELERACAO);

  /* ---------- Som (opcional, sem arquivos externos) ---------- */
  let audioCtx = null;
  function bip(frequencia, duracao, volume) {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const ganho = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequencia;
      ganho.gain.value = volume;
      ganho.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duracao);
      osc.connect(ganho).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duracao);
    } catch (e) {
      /* som é enfeite: se falhar, o jogo continua */
    }
  }

  /* ---------- Preparar uma partida ---------- */
  function reiniciar() {
    cobra = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ];
    anterior = cobra.map((p) => ({ x: p.x, y: p.y }));
    direcao = DIRECOES.direita;
    fila = [];
    pontos = 0;
    acumulado = 0;
    if (elPontos) elPontos.textContent = "0";
    sortearComida();
  }

  function sortearComida() {
    const livres = [];
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLUNAS; x++) {
        if (!cobra.some((p) => p.x === x && p.y === y)) livres.push({ x, y });
      }
    }
    comida = livres.length
      ? livres[Math.floor(Math.random() * livres.length)]
      : { x: -1, y: -1 }; // tabuleiro cheio: vitória
  }

  /* ---------- Um passo da cobra ---------- */
  function passo() {
    if (fila.length) {
      const nova = fila.shift();
      // impede voltar em cima do próprio corpo
      if (nova.x !== -direcao.x || nova.y !== -direcao.y) direcao = nova;
    }

    const cabeca = {
      x: cobra[0].x + direcao.x,
      y: cobra[0].y + direcao.y,
    };

    // bateu na parede?
    if (cabeca.x < 0 || cabeca.y < 0 || cabeca.x >= COLUNAS || cabeca.y >= LINHAS) {
      return terminar();
    }

    const comendo = cabeca.x === comida.x && cabeca.y === comida.y;

    // bateu no próprio corpo? (a última célula sai, então é ignorada)
    const limite = comendo ? cobra.length : cobra.length - 1;
    for (let i = 0; i < limite; i++) {
      if (cobra[i].x === cabeca.x && cobra[i].y === cabeca.y) return terminar();
    }

    anterior = cobra.map((p) => ({ x: p.x, y: p.y }));
    cobra.unshift(cabeca);
    if (!comendo) cobra.pop();

    if (comendo) {
      pontos++;
      if (elPontos) elPontos.textContent = pontos;
      if (pontos > recorde) {
        recorde = pontos;
        if (elRecorde) elRecorde.textContent = recorde;
        try {
          localStorage.setItem(CHAVE_RECORDE, String(recorde));
        } catch (e) {}
      }
      bip(760, 0.08, 0.05);
      sortearComida();
      if (comida.x === -1) return terminar(true);
    }
  }

  /* ---------- Fim de jogo ---------- */
  function terminar(vitoria) {
    estado = "fim";
    bip(vitoria ? 990 : 180, 0.25, 0.06);
    mostrarOverlay(
      vitoria ? "Você venceu! 🏆" : "Fim de jogo",
      vitoria
        ? `Tabuleiro completo com ${pontos} pontos!`
        : `Você fez <strong>${pontos}</strong> ponto${pontos === 1 ? "" : "s"}${
            pontos >= recorde && pontos > 0 ? " — novo recorde!" : ""
          }`,
      "Jogar de novo"
    );
    if (elPausar) elPausar.hidden = true;
  }

  function mostrarOverlay(titulo, texto, botao) {
    if (!elOverlay) return;
    if (elTitulo) elTitulo.textContent = titulo;
    if (elTexto) elTexto.innerHTML = texto;
    if (elAcao) elAcao.textContent = botao;
    elOverlay.classList.add("visivel");
  }

  function esconderOverlay() {
    if (elOverlay) elOverlay.classList.remove("visivel");
  }

  /* ---------- Controles de estado ---------- */
  function comecar() {
    reiniciar();
    estado = "rodando";
    ultimoTempo = 0;
    esconderOverlay();
    if (elPausar) {
      elPausar.hidden = false;
      elPausar.textContent = "Pausar";
    }
    bip(520, 0.06, 0.04);
  }

  function pausar() {
    if (estado !== "rodando") return;
    estado = "pausado";
    mostrarOverlay("Pausado", "Respire e volte quando quiser.", "Continuar");
    if (elPausar) elPausar.textContent = "Continuar";
  }

  function continuar() {
    if (estado !== "pausado") return;
    estado = "rodando";
    ultimoTempo = 0;
    esconderOverlay();
    if (elPausar) elPausar.textContent = "Pausar";
  }

  function alternarPausa() {
    if (estado === "pausado") continuar();
    else pausar();
  }

  function agir() {
    if (estado === "rodando") alternarPausa();
    else if (estado === "pausado") continuar();
    else comecar();
  }

  /* ---------- Entrada do jogador ---------- */
  function enfileirar(nome) {
    if (estado !== "rodando") return;
    const d = DIRECOES[nome];
    const referencia = fila.length ? fila[fila.length - 1] : direcao;
    if (d.x === referencia.x && d.y === referencia.y) return; // mesma direção
    if (d.x === -referencia.x && d.y === -referencia.y) return; // ré
    if (fila.length < 2) fila.push(d);
  }

  const TECLAS = {
    ArrowUp: "cima",
    ArrowDown: "baixo",
    ArrowLeft: "esquerda",
    ArrowRight: "direita",
    w: "cima",
    s: "baixo",
    a: "esquerda",
    d: "direita",
    W: "cima",
    S: "baixo",
    A: "esquerda",
    D: "direita",
  };

  document.addEventListener("keydown", (e) => {
    const nome = TECLAS[e.key];
    if (nome) {
      e.preventDefault();
      if (estado === "pronto") comecar();
      enfileirar(nome);
      return;
    }
    if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "Escape") {
      e.preventDefault();
      if (estado !== "fim") alternarPausa();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (estado !== "rodando") comecar();
    }
  });

  if (elAcao) elAcao.addEventListener("click", agir);
  if (elPausar) elPausar.addEventListener("click", alternarPausa);

  // Botões direcionais (celular)
  document.querySelectorAll("[data-dir]").forEach((botao) => {
    botao.addEventListener("click", () => {
      if (estado === "pronto") comecar();
      enfileirar(botao.dataset.dir);
    });
  });

  // Arraste o dedo sobre o tabuleiro
  let toqueInicial = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      toqueInicial = { x: t.clientX, y: t.clientY };
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (!toqueInicial) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - toqueInicial.x;
      const dy = t.clientY - toqueInicial.y;
      if (Math.hypot(dx, dy) > 24) {
        if (Math.abs(dx) > Math.abs(dy)) enfileirar(dx > 0 ? "direita" : "esquerda");
        else enfileirar(dy > 0 ? "baixo" : "cima");
      }
      toqueInicial = null;
    },
    { passive: true }
  );

  // Se trocar de aba do navegador, pausa (você não perde a partida)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && estado === "rodando") pausar();
  });

  /* ---------- Desenho ---------- */
  function retanguloArredondado(x, y, largura, altura, raio) {
    const r = Math.min(raio, largura / 2, altura / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, largura, altura, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + largura, y, x + largura, y + altura, r);
      ctx.arcTo(x + largura, y + altura, x, y + altura, r);
      ctx.arcTo(x, y + altura, x, y, r);
      ctx.arcTo(x, y, x + largura, y, r);
      ctx.closePath();
    }
  }

  function desenharFundo() {
    const grad = ctx.createLinearGradient(0, 0, TAMANHO, TAMANHO);
    grad.addColorStop(0, "#0a1223");
    grad.addColorStop(1, "#0d1a2b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TAMANHO, TAMANHO);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
    ctx.lineWidth = 1;
    for (let i = 1; i < COLUNAS; i++) {
      const p = Math.round(i * CELULA) + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, TAMANHO);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(TAMANHO, p);
      ctx.stroke();
    }
  }

  function desenharComida(tempo) {
    if (comida.x < 0) return;
    const cx = (comida.x + 0.5) * CELULA;
    const cy = (comida.y + 0.5) * CELULA;
    const pulso = 1 + Math.sin(tempo / 300) * 0.09;
    const raio = CELULA * 0.32 * pulso;

    // brilho
    const brilho = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio * 2.6);
    brilho.addColorStop(0, "rgba(255, 93, 115, 0.45)");
    brilho.addColorStop(1, "rgba(255, 93, 115, 0)");
    ctx.fillStyle = brilho;
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 2.6, 0, Math.PI * 2);
    ctx.fill();

    // fruta
    const grad = ctx.createRadialGradient(cx - raio * 0.3, cy - raio * 0.4, raio * 0.15, cx, cy, raio);
    grad.addColorStop(0, "#ffb3bd");
    grad.addColorStop(1, "#ff4d6a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fill();

    // cabinho
    ctx.strokeStyle = "#5ee08a";
    ctx.lineWidth = Math.max(2, CELULA * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - raio * 0.85);
    ctx.lineTo(cx + raio * 0.35, cy - raio * 1.5);
    ctx.stroke();
  }

  function desenharCobra(t) {
    const total = cobra.length;

    for (let i = total - 1; i >= 0; i--) {
      const atual = cobra[i];
      const antes = anterior[i] || atual;
      const x = (antes.x + (atual.x - antes.x) * t) * CELULA;
      const y = (antes.y + (atual.y - antes.y) * t) * CELULA;

      const proporcao = total > 1 ? i / (total - 1) : 0;
      const margem = CELULA * (0.09 + proporcao * 0.05);

      // corpo
      const grad = ctx.createLinearGradient(x, y, x + CELULA, y + CELULA);
      const r = Math.round(156 - proporcao * 80);
      const g = Math.round(255 - proporcao * 55);
      const b = Math.round(178 - proporcao * 40);
      grad.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
      grad.addColorStop(1, `rgb(${Math.max(r - 40, 0)}, ${Math.max(g - 70, 0)}, ${Math.max(b - 40, 0)})`);

      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(94, 224, 138, 0.55)";
      ctx.shadowBlur = i === 0 ? 22 : 10;
      retanguloArredondado(x + margem, y + margem, CELULA - margem * 2, CELULA - margem * 2, CELULA * 0.34);
      ctx.fill();
      ctx.shadowBlur = 0;

      // olhos na cabeça
      if (i === 0) {
        const cx = x + CELULA / 2;
        const cy = y + CELULA / 2;
        const deslocamento = CELULA * 0.17;
        const olhoX = direcao.x * deslocamento;
        const olhoY = direcao.y * deslocamento;
        const separacao = CELULA * 0.17;
        const base = CELULA * 0.105;

        const olhos =
          direcao.x !== 0
            ? [
                { x: cx + olhoX, y: cy - separacao },
                { x: cx + olhoX, y: cy + separacao },
              ]
            : [
                { x: cx - separacao, y: cy + olhoY },
                { x: cx + separacao, y: cy + olhoY },
              ];

        ctx.fillStyle = "#06281a";
        olhos.forEach((o) => {
          ctx.beginPath();
          ctx.arc(o.x, o.y, base, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        olhos.forEach((o) => {
          ctx.beginPath();
          ctx.arc(o.x - base * 0.28, o.y - base * 0.3, base * 0.34, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  }

  function desenhar(t) {
    const tempo = performance.now();
    desenharFundo();
    desenharComida(tempo);
    desenharCobra(Math.max(0, Math.min(1, t)));
  }

  /* ---------- Laço principal ---------- */
  function loop(agora) {
    requestAnimationFrame(loop);
    if (!ultimoTempo) ultimoTempo = agora;
    const delta = Math.min(agora - ultimoTempo, 250);
    ultimoTempo = agora;

    let t = 1;
    if (estado === "rodando") {
      acumulado += delta;
      let passoMs = passoAtual();
      while (acumulado >= passoMs && estado === "rodando") {
        acumulado -= passoMs;
        passo();
        passoMs = passoAtual();
      }
      if (estado === "rodando") t = acumulado / passoMs;
      else t = 1;
    }
    desenhar(t);
  }

  /* ---------- Começo ---------- */
  reiniciar();
  requestAnimationFrame(loop);
  mostrarOverlay(
    "Jogo da Cobrinha 🐍",
    "Use as setas (ou W A S D) e coma as frutas sem bater na parede nem em você mesma.",
    "Começar"
  );
  if (elPausar) elPausar.hidden = true;
})();