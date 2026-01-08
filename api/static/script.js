/*****************************
 * STATE MANAGEMENT
 *****************************/
let codigoBarrasAtual = "";
let ID_ESTOQUE = "";

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  loadUserSettings();
  loadDashboardStats();

  // Auto-focus barcode input if on coleta page
  if (document.getElementById('coletar').classList.contains('active')) {
    document.getElementById('codigo_barras').focus();
  }

  // Live Search Listener
  const barcodeInput = document.getElementById("codigo_barras");
  let liveSearchTimer;

  barcodeInput.addEventListener("input", function () {
    clearTimeout(liveSearchTimer);
    const val = this.value.trim();

    if (val.length < 3) {
      document.getElementById("autocomplete-list").style.display = "none";
      return;
    }

    // If it looks like a barcode (mostly numbers and > 6 chars), maybe don't search description yet?
    // But user might want to see if barcode partial matches. 
    // Current description search uses LIKE %val%, so it would match barcode if stored in description, but usually not.
    // Let's assume user wants to search description if they are typing.

    liveSearchTimer = setTimeout(() => handleLiveSearch(val), 400);
  });

  // Hide autocomplete on click outside
  document.addEventListener("click", function (e) {
    if (e.target.id !== "codigo_barras") {
      document.getElementById("autocomplete-list").style.display = "none";
    }
  });
});

// Global function to handle license errors
function handleLicenseError(response) {
  if (response.status === 403) {
    return response.json().then(data => {
      if (data.acesso_negado) {
        alert('⚠️ LICENÇA INVÁLIDA\n\n' + data.erro);
        throw new Error(data.erro);
      }
      throw new Error('Acesso negado');
    });
  }
  return response;
}

function handleLiveSearch(termo) {
  if (/^\d+$/.test(termo) && termo.length > 6) return;

  fetch(`/estoque/${encodeURIComponent(termo)}?page=1&per_page=10`)
    .then(handleLicenseError)
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById("autocomplete-list");
      list.innerHTML = "";

      if (data.erro || !data.produtos || data.produtos.length === 0) {
        list.style.display = "none";
        return;
      }

      list.style.display = "block";

      data.produtos.forEach(p => {
        const li = document.createElement("li");
        li.innerHTML = `
                    <span>${p.Descricao}</span>
                    <span class="price-tag">R$ ${p.Preco ? Number(p.Preco).toFixed(2) : '0.00'}</span>
                `;
        li.onclick = () => {
          document.getElementById("codigo_barras").value = p.codigo_barras || "";
          list.style.display = "none";

          const produtoFormatado = {
            Descricao: p.Descricao,
            Preco: p.Preco,
            Quantidade: p.Quantidade,
            ID_ESTOQUE: p.ID_ESTOQUE
          };
          prepararModalProduto(produtoFormatado, p.codigo_barras || "");
        };
        list.appendChild(li);
      });
    })
    .catch(err => {
      console.error(err);
      document.getElementById("autocomplete-list").style.display = "none";
    });
}

/*****************************
 * NAVIGATION & UI
 *****************************/
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.page-section');
  const pageTitle = document.getElementById('pageTitle');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class
      navBtns.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      // Add active class
      btn.classList.add('active');
      const targetId = btn.dataset.target;
      document.getElementById(targetId).classList.add('active');

      // Update Title
      pageTitle.innerText = btn.innerText.trim();

      // Action based on section
      if (targetId === 'dashboard') loadDashboardStats();
      if (targetId === 'itens-coletados') listarItens();
      if (targetId === 'historico') listarHistorico();
      if (targetId === 'coletar') document.getElementById('codigo_barras').focus();
    });
  });
}

function listarHistorico() {
  fetch('/listar-historico')
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("historicoTableBody");
      tbody.innerHTML = "";

      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Nenhum histórico encontrado.</td></tr>";
        return;
      }

      data.forEach(item => {
        const tr = document.createElement("tr");
        const btnDownload = item.download_url
          ? `<a href="${item.download_url}" target="_blank" class="action-btn" title="Baixar TXT"><i class="fa-solid fa-download"></i></a>`
          : '<span style="color:#666">-</span>';

        tr.innerHTML = `
                    <td>${item.data_finalizacao}</td>
                    <td>${item.total_itens}</td>
                    <td>R$ ${item.valor_total.toFixed(2)}</td>
                    <td style="${item.total_divergencias > 0 ? 'color: var(--warning); font-weight:bold;' : ''}">${item.total_divergencias}</td>
                    <td>${btnDownload}</td>
                `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error("Erro ao listar histórico:", err));
}

function loadUserSettings() {
  const nome = localStorage.getItem("nome_usuario");
  if (nome) {
    document.getElementById("nome_usuario").value = nome;
    document.getElementById("userNameDisplay").innerText = nome;
  }
}

document.getElementById("btnSalvarUsuario").addEventListener("click", () => {
  const nome = document.getElementById("nome_usuario").value.trim();
  if (!nome) return alert("Digite um nome.");

  localStorage.setItem("nome_usuario", nome);
  document.getElementById("userNameDisplay").innerText = nome;
  alert("Preferências salvas com sucesso!");
});

/*****************************
 * DASHBOARD
 *****************************/
function loadDashboardStats() {
  fetch('/dashboard-stats')
    .then(res => res.json())
    .then(data => {
      if (data.erro) return console.error(data.erro);

      // Animate Numbers
      animateValue("statTotalBo", 0, data.total_itens_coletados, 1000);
      document.getElementById("statDivVal").innerText = `R$ ${data.valor_divergencia.toFixed(2)}`;
      animateValue("statDivergencias", 0, data.total_divergencias, 1000);
      animateValue("statFinalizadas", 0, data.contagens_finalizadas, 1000);

      // Populate Recent Table
      const tbody = document.getElementById("recentActivityTable");
      tbody.innerHTML = "";

      if (data.itens_recentes.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3'>Nenhuma atividade recente</td></tr>";
        return;
      }

      data.itens_recentes.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                    <td>${item.descricao}</td>
                    <td>${item.quantidade}</td>
                    <td>${item.data_hora.split(" ")[1]}</td> 
                `; // Showing time only for brevity, or full date
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error(err));
}

function animateValue(id, start, end, duration) {
  if (start === end) return;
  const range = end - start;
  let current = start;
  const increment = end > start ? 1 : -1;
  const stepTime = Math.abs(Math.floor(duration / range));
  const obj = document.getElementById(id);

  const timer = setInterval(function () {
    current += increment;
    obj.innerHTML = current;
    if (current == end) {
      clearInterval(timer);
    }
  }, stepTime > 0 ? stepTime : 10); // Minimum 10ms
}

/*****************************
 * COLETAR / BUSCAR
 *****************************/
function buscarProduto() {
  const termo = document.getElementById("codigo_barras").value.trim();
  if (!termo) return alert("Digite um código de barras ou descrição.");

  // Simple heuristic: If it has letters or is longer than typical barcode (14), assume description.
  // Or just try barcode first, failover to description?
  // Let's assume if it contains non-digits, it's a description.
  const isBarcode = /^\d+$/.test(termo);

  if (isBarcode) {
    fetch(`/produto/${termo}`)
      .then(res => res.json())
      .then(data => {
        if (data.erro) {
          alert("Produto não encontrado por código. Tentando busca por descrição...");
          buscarPorDescricao(termo); // Fallback
        } else {
          prepararModalProduto(data, termo);
        }
      })
      .catch(err => console.error(err));
  } else {
    buscarPorDescricao(termo);
  }
}

function buscarPorDescricao(termo) {
  // Busca por descrição (usando o endpoint paginado que criamos, padrão page=1)
  fetch(`/estoque/${encodeURIComponent(termo)}?page=1&per_page=50`)
    .then(res => res.json())
    .then(data => {
      if (data.erro || (data.produtos && data.produtos.length === 0)) {
        alert("Nenhum produto encontrado.");
        return;
      }

      // If only 1 result, go straight to collection
      if (data.produtos.length === 1) {
        const p = data.produtos[0];
        // Map the formats
        const produtoFormatado = {
          Descricao: p.Descricao,
          Preco: p.Preco,
          Quantidade: p.Quantidade,
          ID_ESTOQUE: p.ID_ESTOQUE
        };
        prepararModalProduto(produtoFormatado, p.codigo_barras || "");
        return;
      }

      // Multiple results -> Show Search Modal
      mostrarResultadosBusca(data.produtos);
    })
    .catch(err => console.error(err));
}

function mostrarResultadosBusca(lista) {
  const tbody = document.getElementById("searchResultsBody");
  tbody.innerHTML = "";

  lista.forEach((p, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${p.Descricao}</td>
            <td>R$ ${p.Preco ? Number(p.Preco).toFixed(2) : '0.00'}</td>
            <td>${p.Quantidade}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-index="${index}">
                    <i class="fa-solid fa-check"></i>
                </button>
            </td>
        `;

    // Add event listener to the button
    const btn = tr.querySelector('button');
    btn.addEventListener('click', () => {
      fecharSearchModal();
      const produtoFormatado = {
        Descricao: p.Descricao,
        Preco: p.Preco,
        Quantidade: p.Quantidade,
        ID_ESTOQUE: p.ID_ESTOQUE
      };
      prepararModalProduto(produtoFormatado, p.codigo_barras || "");
    });

    tbody.appendChild(tr);
  });

  document.getElementById("searchModal").style.display = "flex";
}

function fecharSearchModal() {
  document.getElementById("searchModal").style.display = "none";
}

function selecionarDoSearch(produto) {
  fecharSearchModal();
  const produtoFormatado = {
    Descricao: produto.Descricao,
    Preco: produto.Preco,
    Quantidade: produto.Quantidade,
    ID_ESTOQUE: produto.ID_ESTOQUE
  };
  prepararModalProduto(produtoFormatado, produto.codigo_barras || "");
}

function prepararModalProduto(data, barcode) {
  codigoBarrasAtual = barcode; // Guarda o barcode para salvar
  ID_ESTOQUE = data.ID_ESTOQUE;

  document.getElementById("descricaoProduto").innerText = data.Descricao;
  document.getElementById("quantidadeSistema").innerText = data.Quantidade;
  document.getElementById("preco_atual").innerText = `R$ ${data.Preco ? Number(data.Preco).toFixed(2) : '0.00'}`;

  // Pre-fill
  document.getElementById("preco").value = data.Preco;
  document.getElementById("quantidadeContada").value = "";

  abrirModal();
}

/*****************************
 * MODAL
 *****************************/
function abrirModal() {
  document.getElementById("itemModal").style.display = "flex";
  document.getElementById("quantidadeContada").focus();
}

function fecharModal() {
  document.getElementById("itemModal").style.display = "none";
}

/*****************************
 * SALVAR
 *****************************/
function salvarEstoque() {
  const nome_usuario = localStorage.getItem("nome_usuario");
  if (!nome_usuario) {
    alert("Configure seu usuário na aba Configurações primeiro.");
    fecharModal();
    return;
  }

  const qtd = document.getElementById("quantidadeContada").value.trim();
  const preco = document.getElementById("preco").value.trim();

  fetch(`/salvar/${nome_usuario}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo_barras: codigoBarrasAtual,
      quantidade: qtd,
      preco: preco,
      ID_ESTOQUE: ID_ESTOQUE
    })
  })
    .then(res => res.json())
    .then(data => {
      fecharModal();
      document.getElementById("codigo_barras").value = "";
      document.getElementById("codigo_barras").focus();

      // Refresh Dashboard if visible, otherwise will refresh on click
      loadDashboardStats();
    })
    .catch(err => console.error(err));
}

/*****************************
 * LISTAGEM
 *****************************/
function listarItens(filtro = "") {
  let url = "/listar-contagem";
  if (document.getElementById("descricao") && document.getElementById("descricao").value) {
    url += `/${document.getElementById("descricao").value}`;
  }

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("itens-container");
      container.innerHTML = "";

      if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: #94a3b8;'>Nenhum item coletado.</p>";
        return;
      }

      data.forEach(item => {
        const card = document.createElement("div");
        card.classList.add("item-card");
        card.innerHTML = `
                    <div class="item-header">
                        <span class="item-code"><i class="fa-solid fa-barcode"></i> ${item.codigo_barras}</span>
                        <span class="date">${item.data_hora}</span>
                    </div>
                    <div class="item-desc">${item.descricao}</div>
                    <div class="item-stats">
                        <span><i class="fa-solid fa-calculator"></i> Qtd: ${item.quantidade}</span>
                        <span><i class="fa-solid fa-boxes-stacked"></i> Sist: ${item.qnt_sist}</span>
                        ${(() => {
            const diff = item.quantidade - (item.qnt_sist || 0);
            const color = diff === 0 ? 'var(--success)' : (diff > 0 ? '#0ea5e9' : 'var(--danger)');
            // Using Blue for positive (surplus) and Red for negative (missing), or keeping Green/Red?
            // User example: 34 system, 108 counted -> +74.
            // Let's stick to the previous color logic but maybe distinguish positive/negative?
            // Previous was: diff === 0 ? success : danger.
            // Let's keep danger for now as any divergence is a warning, or use a neutral color for positive.
            // Actually, let's keep it simple: Green if 0, Red if != 0, but show the sign.

            const displayColor = diff === 0 ? 'var(--success)' : 'var(--danger)';
            // If user explicitly wants +74, let's format matching that.

            const icon = diff === 0 ? 'fa-check' : 'fa-triangle-exclamation';
            const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

            return `<span style="color: ${displayColor}; font-weight: bold;"><i class="fa-solid ${icon}"></i> Dif: ${diffStr}</span>`;
          })()}             </div>
                    <div class="item-actions">
                        <button class="action-btn" onclick="editarItem(${item.id}, '${item.codigo_barras}', ${item.quantidade})">
                            <i class="fa-solid fa-pen"></i> Editar
                        </button>
                        <button class="action-btn danger" onclick="excluirItem(${item.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
        container.appendChild(card);
      });
    })
    .catch(err => console.error(err));
}

// Search Listener
const descricaoInput = document.getElementById("descricao");
if (descricaoInput) {
  let debounceTimer;
  descricaoInput.addEventListener("keyup", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => listarItens(), 300);
  });
}

function editarItem(id, codigo, qtd) {
  const novaQtd = prompt(`Editar quantidade para ${codigo}:`, qtd);
  if (novaQtd !== null) {
    fetch(`/editar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantidade: novaQtd })
    }).then(() => listarItens());
  }
}

function excluirItem(id) {
  if (confirm("Excluir item?")) {
    fetch(`/excluir/${id}`, { method: 'DELETE' })
      .then(() => listarItens());
  }
}

function finalizarContagemAction() {
  if (!confirm("Deseja finalizar a contagem atual?\n\nIsso irá:\n1. Arquivar a contagem no histórico.\n2. Limpar a lista de itens atuais.")) {
    return;
  }

  fetch('/finalizar-contagem', { method: 'POST' })
    .then(async response => {
      const data = await response.json();

      if (response.status === 400) {
        alert('Atenção: ' + (data.message || 'Não foi possível finalizar.'));
        return;
      }

      if (!response.ok || data.erro) {
        throw new Error(data.erro || data.message || 'Erro desconhecido');
      }

      // Success Case (200)
      alert('Contagem finalizada! O download do arquivo iniciará em breve.');

      if (data.download_url) {
        window.location.href = data.download_url;
      }

      listarItens();
      loadDashboardStats();
    })
    .catch(error => {
      console.error('Erro ao finalizar:', error);
      alert('Erro: ' + error.message);
    });
}

const btnFinalizarConfig = document.getElementById('finalizar-btn-config');
if (btnFinalizarConfig) {
  btnFinalizarConfig.addEventListener('click', finalizarContagemAction);
}
