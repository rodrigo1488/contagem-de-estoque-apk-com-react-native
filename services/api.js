import axios from 'axios';
import { getSettings } from '../storage/settings';

const getApiClient = async () => {
  const settings = await getSettings();
  let baseURL = '';

  if (settings) {
    if (settings.useLocalServer) {
      baseURL = `http://${settings.localIp}:${settings.localPort}`;
    } else {
      baseURL = settings.publicUrl;
    }
  }

  const api = axios.create({
    baseURL,
  });

  return api;
};

export default getApiClient;
