import {menuAPI} from './menu-api.js';
export default {
  async fetch(request, env) {
    const response = await menuAPI(request, env);
    if (response) return response;
    return env.ASSETS.fetch(request);
  },
};
