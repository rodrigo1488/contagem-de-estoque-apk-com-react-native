import axios from 'axios';
import { getSettings } from '../storage/settings';

// --- Interfaces based on API_DOCUMENTATION.md ---

export interface HealthCheckResponse {
  status: string;
}

export interface ProductResponse {
  Descricao: string;
  Preco: number;
  Quantidade: number;
  ID_ESTOQUE: number;
}

export interface StockItem {
  Descricao: string;
  Preco: number;
  Quantidade: number;
  ID_ESTOQUE: number;
  codigo_barras: string;
}

export interface StockSearchResponse {
  page: number;
  per_page: number;
  total: number;
  produtos: StockItem[];
}

export interface CountItem {
  id: number;
  descricao: string;
  codigo_barras: string;
  quantidade: number;
  qnt_sist: number;
  nome_user: string;
  data_hora: string;
}

export interface SaveCountPayload {
  codigo_barras: string;
  quantidade?: number;
  preco?: number;
  id?: number; // Maps to ID_ESTOQUE
}

export interface EditCountPayload {
  quantidade: number;
}

// License Interfaces
export interface LicenseConfigPayload {
  serial: string;
}

export interface LicenseStatusResponse {
  configurado: boolean;
  serial?: string;
  valida: boolean;
  ativa: boolean;
  max_conexoes: number;
  conexoes_ativas?: number;
  mensagem: string;
}

export interface LicenseValidationPayload {
  forcar_validacao?: boolean;
}

export interface LicenseValidationResponse {
  valida: boolean;
  mensagem: string;
  max_conexoes: number;
  conexoes_ativas: number;
  identificador_conexao?: string;
}

export interface LicenseSerialResponse {
  configurado: boolean;
  serial_oculto?: string;
}

// --- Dashboard Interfaces ---

export interface RecentItem {
  descricao: string;
  quantidade: number;
  data_hora: string;
}

export interface DashboardStatsResponse {
  total_itens_coletados: number;
  valor_divergencia: number;
  total_divergencias: number;
  contagens_finalizadas: number;
  itens_recentes: RecentItem[];
}

export interface HistoryItem {
  id: number;
  data_finalizacao: string;
  total_itens: number;
  valor_total: number;
  total_divergencias: number;
  download_url: string;
}

export interface FinalizeCountResponse {
  message: string;
  id_contagem: number;
  divergencias: number;
  download_url: string;
}

// --- Internal Helper ---

const getClient = async () => {
  const settings = await getSettings();
  let baseURL = 'http://localhost:5000'; // Default per doc
  let timeout = 10000; // Default timeout for local

  if (settings) {
    if (settings.useLocalServer) {
      if (settings.localIp && settings.localPort) {
        baseURL = `http://${settings.localIp}:${settings.localPort}`;
      }
      timeout = 10000; // 10s for local network
    } else if (settings.publicUrl) {
      baseURL = settings.publicUrl;
      timeout = 30000; // 30s for public URL (slower connection)
    }
  }

  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Interceptor para tratar erros de licença (403)
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 403) {
        const data = error.response.data;

        if (data?.acesso_negado) {
          let titulo = '⚠️ LICENÇA INVÁLIDA';
          const mensagem = data.erro;

          // Customizar título baseado no tipo de erro
          if (mensagem.includes('vencida')) {
            titulo = '⏰ LICENÇA VENCIDA';
          } else if (mensagem.includes('suspensa')) {
            titulo = '🚫 LICENÇA SUSPENSA';
          } else if (mensagem.includes('Serial não encontrado')) {
            titulo = '❓ SERIAL NÃO CADASTRADO';
          } else if (mensagem.includes('acessos')) {
            titulo = '👥 LIMITE DE ACESSOS EXCEDIDO';
          } else if (mensagem.includes('serial do sistema')) {
            titulo = '⚠️ ERRO DE SISTEMA';
          }

          // Usar Alert do React Native (precisa ser importado onde for usado)
          // Por enquanto, apenas logamos e rejeitamos
          console.error('[LICENSE ERROR]', titulo, mensagem);

          // Criar erro customizado com informações da licença
          const licenseError = new Error(mensagem);
          (licenseError as any).isLicenseError = true;
          (licenseError as any).title = titulo;
          (licenseError as any).originalError = data;

          return Promise.reject(licenseError);
        }
      }

      return Promise.reject(error);
    }
  );

  console.log('[API] Initializing client with baseURL:', baseURL, 'timeout:', timeout);

  return { client, settings };
};

// --- API Methods ---

export const api = {
  // 1. Health Check
  checkHealth: async (): Promise<HealthCheckResponse> => {
    const { client } = await getClient();
    const response = await client.get('/check_health');
    return response.data;
  },

  // 2. Buscar Produto por Código de Barras
  getProduct: async (codigoBarras: string): Promise<ProductResponse> => {
    const { client } = await getClient();
    const response = await client.get(`/produto/${codigoBarras}`);
    return response.data;
  },

  // 3. Buscar Estoque por Descrição
  searchStock: async (descricao: string, page = 0, perPage = 10): Promise<StockSearchResponse> => {
    const { client } = await getClient();
    const response = await client.get(`/estoque/${descricao}`, {
      params: { page, per_page: perPage },
    });
    return response.data;
  },

  // 4. Listar Todas as Contagens
  getCounts: async (): Promise<CountItem[]> => {
    const { client } = await getClient();
    const response = await client.get('/listar-contagem');
    return response.data;
  },

  // 5. Listar Contagem por Descrição
  searchCounts: async (itemDescricao: string): Promise<CountItem[]> => {
    const { client } = await getClient();
    // Doc says: GET /listar-contagem/<item_descricao>
    const response = await client.get(`/listar-contagem/${itemDescricao}`);
    return response.data;
  },

  // 6 & 7. Salvar Contagem
  saveCount: async (payload: SaveCountPayload): Promise<void> => {
    const { client, settings } = await getClient();
    const username = settings?.username;

    // Doc says: If username provided, use /salvar/<username>, else /salvar
    const url = username ? `/salvar/${username}` : '/salvar';

    console.log('[API] Saving count payload:', JSON.stringify(payload));
    await client.post(url, payload);
  },

  // 8. Editar Item de Contagem
  editCount: async (itemId: number, payload: EditCountPayload): Promise<void> => {
    const { client } = await getClient();
    await client.put(`/editar/${itemId}`, payload);
  },

  // 9. Excluir Item de Contagem
  deleteCount: async (itemId: number): Promise<void> => {
    const { client } = await getClient();
    await client.delete(`/excluir/${itemId}`);
  },

  // --- License Endpoints ---

  configureLicense: async (payload: LicenseConfigPayload): Promise<any> => {
    const { client } = await getClient();
    const response = await client.post('/licenca/configurar', payload);
    return response.data;
  },

  getLicenseStatus: async (): Promise<LicenseStatusResponse> => {
    const { client } = await getClient();
    const response = await client.get('/licenca/status');
    return response.data;
  },

  validateLicense: async (payload?: LicenseValidationPayload): Promise<LicenseValidationResponse> => {
    const { client } = await getClient();
    const response = await client.post('/licenca/validar', payload);
    return response.data;
  },

  getLicenseSerial: async (): Promise<LicenseSerialResponse> => {
    const { client } = await getClient();
    const response = await client.get('/licenca/serial');
    return response.data;
  },

  // --- Dashboard Endpoints ---

  getDashboardStats: async (): Promise<DashboardStatsResponse> => {
    const { client } = await getClient();
    const response = await client.get('/dashboard-stats');
    return response.data;
  },

  getHistory: async (): Promise<HistoryItem[]> => {
    const { client } = await getClient();
    const response = await client.get('/listar-historico');
    return response.data;
  },

  finalizeCount: async (): Promise<FinalizeCountResponse> => {
    const { client } = await getClient();
    const response = await client.post('/finalizar-contagem');
    return response.data;
  }
};

export default api;
