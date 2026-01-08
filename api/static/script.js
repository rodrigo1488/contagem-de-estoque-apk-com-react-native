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
      if (targetId === 'configuracoes') loadLicenseInfo();
      if (targetId === 'clientes') listarClientes();
      if (targetId === 'itens') listarItens();
    });
  });
}

/*****************************
 * LICENSE INFO
 *****************************/
function loadLicenseInfo() {
  const container = document.getElementById('license-info-container');
  container.innerHTML = '<div class="license-info-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando informações...</div>';

  fetch('/info-licenca')
    .then(res => res.json())
    .then(data => {
      if (data.erro) {
        container.innerHTML = `
          <div class="license-info-row">
            <span class="license-info-label">Status:</span>
            <span class="license-info-value license-status-invalid">
              <i class="fa-solid fa-circle-xmark"></i> Erro
            </span>
          </div>
          <div class="license-info-row">
            <span class="license-info-label">Mensagem:</span>
            <span class="license-info-value">${data.erro}</span>
          </div>
        `;
        return;
      }

      // Determinar classe de status
      const statusClass = data.status === 'valida' ? 'license-status-valid' : 'license-status-invalid';
      const statusIcon = data.status === 'valida' ? 'fa-circle-check' : 'fa-circle-xmark';
      const statusText = data.status === 'valida' ? 'Válida' : 'Inválida';

      // Formatar validade
      let validadeFormatada = 'Não definida';
      if (data.validade) {
        try {
          const dataObj = new Date(data.validade + 'T00:00:00');
          validadeFormatada = dataObj.toLocaleDateString('pt-BR');

          // Verificar se está próximo do vencimento (30 dias)
          const hoje = new Date();
          const diffTime = dataObj - hoje;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 0 && diffDays <= 30) {
            validadeFormatada += ` <span class="license-status-warning">(${diffDays} dias)</span>`;
          }
        } catch (e) {
          validadeFormatada = data.validade;
        }
      }

      container.innerHTML = `
        <div class="license-info-row">
          <span class="license-info-label">Serial:</span>
          <span class="license-info-value">${data.serial || 'N/A'}</span>
        </div>
        <div class="license-info-row">
          <span class="license-info-label">Status:</span>
          <span class="license-info-value ${statusClass}">
            <i class="fa-solid ${statusIcon}"></i> ${statusText}
          </span>
        </div>
        <div class="license-info-row">
          <span class="license-info-label">Validade:</span>
          <span class="license-info-value">${validadeFormatada}</span>
        </div>
        <div class="license-info-row">
          <span class="license-info-label">Acessos Permitidos:</span>
          <span class="license-info-value">${data.numero_acessos || 'Ilimitado'}</span>
        </div>
        ${data.mensagem && data.status !== 'valida' ? `
        <div class="license-info-row">
          <span class="license-info-label">Mensagem:</span>
          <span class="license-info-value license-status-invalid">${data.mensagem}</span>
        </div>
        ` : ''}
      `;
    })
    .catch(err => {
      console.error('Erro ao carregar informações de licença:', err);
      container.innerHTML = `
        <div class="license-info-row">
          <span class="license-info-label">Erro:</span>
          <span class="license-info-value license-status-invalid">Não foi possível carregar as informações</span>
        </div>
      `;
    });
}

// Botão de revalidar licença
document.addEventListener('DOMContentLoaded', () => {
  const btnRevalidar = document.getElementById('btnRevalidarLicenca');
  if (btnRevalidar) {
    btnRevalidar.addEventListener('click', () => {
      btnRevalidar.disabled = true;
      btnRevalidar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Revalidando...';

      fetch('/admin/revalidar-licenca', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          alert('Licença revalidada com sucesso!');
          loadLicenseInfo(); // Recarregar informações
        })
        .catch(err => {
          alert('Erro ao revalidar licença: ' + err.message);
        })
        .finally(() => {
          btnRevalidar.disabled = false;
          btnRevalidar.innerHTML = '<i class="fa-solid fa-rotate"></i> Revalidar Licença';
        });
    });
  }
});

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
 * LISTAGEM PRODUTOS
 *****************************/
/*****************************
 * LISTAGEM PRODUTOS
 *****************************/
function listarProdutos() {
  fetch('/produtos')
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('produtosTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#666;">Nenhum produto encontrado.</td></tr>';
        return;
      }

      data.forEach(p => {
        const tr = document.createElement('tr');
        const preco = p.preco !== undefined ? Number(p.preco) : 0;
        const safeDesc = (p.descricao || '').replace(/'/g, "\\'");

        tr.innerHTML = `
          <td><strong>${p.descricao}</strong></td>
          <td>R$ ${preco.toFixed(2)}</td>
          <td>${p.quantidade_sist || 0}</td>
          <td class="actions-cell">
            <button class="action-btn" title="Editar" onclick="editarProduto(${p.ID_ESTOQUE}, '${safeDesc}', ${preco}, ${p.quantidade_sist || 0})">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="action-btn danger" title="Inativar" onclick="inativarProduto(${p.ID_ESTOQUE})">
                <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error('Erro ao listar produtos:', err));
}

function adicionarProduto() {
  const descInput = document.getElementById('produtoDescricao');
  const descricao = descInput.value.trim();

  if (!descricao) return alert("Digite a descrição do produto.");

  const preco = prompt("Preço de Venda (R$):", "0.00");
  const qtd = prompt("Quantidade Sistema:", "0");

  fetch('/produtos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      descricao: descricao,
      preco: parseFloat(preco) || 0,
      quantidade_sist: parseInt(qtd) || 0
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.id) {
        alert("Produto criado com sucesso!");
        descInput.value = "";
        listarProdutos();
      } else {
        alert("Erro: " + (data.message || "Desconhecido"));
      }
    })
    .catch(err => console.error(err));
}

function editarProduto(id, descAtual, precoAtual, qtdAtual) {
  const novaDesc = prompt("Descrição:", descAtual);
  if (novaDesc === null) return;

  const novoPreco = prompt("Preço de Venda (R$):", precoAtual);
  const novaQtd = prompt("Quantidade Sistema:", qtdAtual);

  fetch(`/produtos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      descricao: novaDesc,
      preco: parseFloat(novoPreco) || 0,
      quantidade_sist: parseInt(novaQtd) || 0
    })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      listarProdutos();
    })
    .catch(err => console.error(err));
}

function inativarProduto(id) {
  if (!confirm("Deseja inativar este produto?")) return;

  fetch(`/produtos/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      listarProdutos();
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

/*****************************
 * LISTAGEM CLIENTES
 *****************************/
function listarClientes() {
  fetch('/clientes')
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('clientesTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666;">Nenhum cliente encontrado.</td></tr>';
        return;
      }

      data.forEach(c => {
        const tr = document.createElement('tr');
        const telefone = c.FONE_CELUL ? `(${c.DDD_CELUL || 'XX'}) ${c.FONE_CELUL}` : '-';

        // Escape strings for onclick
        const safeNome = (c.NOME || '').replace(/'/g, "\\'");

        tr.innerHTML = `
          <td><strong>${c.NOME}</strong></td>
          <td>${c.CONTATO || '-'}</td>
          <td>${telefone}</td>
          <td>${c.END_BAIRRO || '-'}</td>
          <td class="actions-cell">
            <button class="action-btn" title="Editar" onclick="editarCliente(${c.ID_CLIENTE}, '${safeNome}', '${c.CONTATO || ''}', '${c.DDD_CELUL || ''}', '${c.FONE_CELUL || ''}', '${c.END_BAIRRO || ''}')">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="action-btn danger" title="Excluir" onclick="excluirCliente(${c.ID_CLIENTE})">
                <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error('Erro ao listar clientes:', err));
}

function adicionarCliente() {
  const nomeInput = document.getElementById('clienteNome');
  const nome = nomeInput.value.trim();

  if (!nome) return alert("Digite o nome do cliente.");

  // Opcionais (simples prompts por enquanto, ideal seria um modal completo)
  const contato = prompt("Contato (opcional):", "") || "";
  const ddd = prompt("DDD (opcional):", "") || "";
  const fone = prompt("Telefone (opcional):", "") || "";
  const bairro = prompt("Bairro (opcional):", "") || "";

  fetch('/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      NOME: nome,
      CONTATO: contato,
      DDD_CELUL: ddd,
      FONE_CELUL: fone,
      END_BAIRRO: bairro
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.id) {
        alert("Cliente adicionado com sucesso!");
        nomeInput.value = "";
        listarClientes();
      } else {
        alert("Erro ao adicionar: " + (data.message || "Erro desconhecido"));
      }
    })
    .catch(err => console.error(err));
}

function editarCliente(id, nomeAtual, contatoAtual, dddAtual, foneAtual, bairroAtual) {
  const novoNome = prompt("Nome:", nomeAtual);
  if (novoNome === null) return; // Cancelado

  const novoContato = prompt("Contato:", contatoAtual) || "";
  const novoDdd = prompt("DDD:", dddAtual) || "";
  const novoFone = prompt("Telefone:", foneAtual) || "";
  const novoBairro = prompt("Bairro:", bairroAtual) || "";

  fetch(`/clientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      NOME: novoNome,
      CONTATO: novoContato,
      DDD_CELUL: novoDdd,
      FONE_CELUL: novoFone,
      END_BAIRRO: novoBairro
    })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      listarClientes();
    })
    .catch(err => console.error(err));
}

function excluirCliente(id) {
  if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

  fetch(`/clientes/${id}`, {
    method: 'DELETE'
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      listarClientes();
    })
    .catch(err => console.error(err));
}
