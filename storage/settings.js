import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@estoque_app_settings';

export const getSettings = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Error reading settings', e);
  }
};

export const saveSettings = async (value) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Error saving settings', e);
  }
};
