// auth.js - Authentication module
import { CONFIG } from './config.js';

export class AuthManager {
  constructor() {
    this.supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    this.user = null;
  }

  async login(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    this.user = data.user;
    return data.user;
  }

  async register(email, password) {
    const { data, error } = await this.supabase.auth.signUp({ 
      email, 
      password 
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    return data;
  }

  async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    this.user = null;
  }

  getUser() {
    return this.user;
  }

  getSupabase() {
    return this.supabase;
  }
}