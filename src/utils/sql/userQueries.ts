import { supabase } from '../supabase';
import { UserSettings } from '@/types/settings';

export const userQueries = {
  async getUserSettings(userId: string): Promise<UserSettings> {
    console.log('Getting settings for user:', userId);
    const { data, error } = await supabase
      .from('users')
      .select('settings')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user settings:', error);
      throw error;
    }
    
    console.log('Retrieved settings from database:', data?.settings);
    return data?.settings || {};
  },

  async updateUserSettings(userId: string, settings: UserSettings) {
    console.log('Updating settings for user:', userId);
    console.log('Settings payload:', settings);
    
    const { error } = await supabase
      .from('users')
      .update({
        settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
    
    // Get the updated settings
    return this.getUserSettings(userId);
  }
}; 