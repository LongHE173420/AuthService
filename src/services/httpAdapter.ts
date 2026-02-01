import axios from 'axios';
import { API_URL } from '../config/mode';

async function post(path: string, body: any, headers: Record<string, any> = {}) {
  return axios.post(`${API_URL}${path}`, body, { headers, validateStatus: () => true });
}

async function get(path: string, headers: Record<string, any> = {}) {
  return axios.get(`${API_URL}${path}`, { headers, validateStatus: () => true });
}

export default { post, get };
