// Lightweight runtime i18n helper (non-module so it can define window.t)
(function(){
  const TRANSLATIONS = {
    en: {
  tank_nutz: 'TANK NUTZ', score: 'Score', health: 'Health', pause: 'Pause', resume: 'Resume', sound: 'Sound', sound_on: 'Sound On', sound_off: 'Sound Off', controls: 'Controls', you_died: 'YOU DIED', restart: 'Restart', single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', controls_title: 'Controls', right_click_hold: 'Right-click (hold)', pause_vertical_scrolling: 'Pause vertical scrolling', keys_hint_label: 'P / M', keys_hint_desc: 'P=Pause, M=Toggle sound', close: 'Close', press_r_restart: 'Press R to restart', on: 'On', off: 'Off', move_desc: 'Move (forward/left/back/right)', left_click: 'Left-click', fire_weapon: 'Fire weapon', shift_hold: 'Shift (hold)', accel_desc: 'Accelerate (speed boost)', mouse_aim: 'Mouse aim', mouse_aim_desc: 'Aim with mouse or touch'
    },
    es: {
  tank_nutz: 'TANK NUTZ', score: 'Puntuación', health: 'Salud', pause: 'Pausa', resume: 'Continuar', sound: 'Sonido', sound_on: 'Sonido Activado', sound_off: 'Sonido Desactivado', controls: 'Controles', you_died: 'HAS MUERTO', restart: 'Reiniciar', single: 'Simple', double: 'Doble', triple: 'Triple', quad: 'Cuádruple', controls_title: 'Controles', right_click_hold: 'Clic derecho (mantener)', pause_vertical_scrolling: 'Pausar desplazamiento vertical', keys_hint_label: 'P / M', keys_hint_desc: 'P=Pausa, M=Activar/desactivar sonido', close: 'Cerrar', press_r_restart: 'Pulsa R para reiniciar', on: 'Activado', off: 'Desactivado', move_desc: 'Mover (adelante/izquierda/atrás/derecha)', left_click: 'Clic izquierdo', fire_weapon: 'Disparar arma', shift_hold: 'Shift (mantener)', accel_desc: 'Acelerar (impulso de velocidad)', mouse_aim: 'Apuntar con ratón', mouse_aim_desc: 'Apunta con ratón o táctil'
    },
    fr: {
  tank_nutz: 'TANK NUTZ', score: 'Score', health: 'Vie', pause: 'Pause', resume: 'Reprendre', sound: 'Son', sound_on: 'Son activé', sound_off: 'Son désactivé', controls: 'Contrôles', you_died: 'VOUS ÊTES MORT', restart: 'Redémarrer', single: 'Simple', double: 'Double', triple: 'Triple', quad: 'Quadruple', controls_title: 'Contrôles', right_click_hold: 'Clic droit (maintenir)', pause_vertical_scrolling: 'Mettre en pause le défilement vertical', keys_hint_label: 'P / M', keys_hint_desc: 'P=Pause, M=Basculer le son', close: 'Fermer', press_r_restart: 'Appuyez sur R pour redémarrer', on: 'Activé', off: 'Désactivé', move_desc: 'Déplacer (avant/gauche/arrière/droite)', left_click: 'Clic gauche', fire_weapon: 'Tirer', shift_hold: 'Shift (maintenir)', accel_desc: 'Accélérer (boost de vitesse)', mouse_aim: 'Visée souris', mouse_aim_desc: 'Visez avec la souris ou le tactile'
    },
    de: {
  tank_nutz: 'TANK NUTZ', score: 'Punktzahl', health: 'Leben', pause: 'Pause', resume: 'Fortsetzen', sound: 'Sound', sound_on: 'Sound an', sound_off: 'Sound aus', controls: 'Steuerung', you_died: 'DU BIST GESTORBEN', restart: 'Neustart', single: 'Einfach', double: 'Doppel', triple: 'Dreifach', quad: 'Vierfach', controls_title: 'Steuerung', right_click_hold: 'Rechtsklick (halten)', pause_vertical_scrolling: 'Vertikales Scrollen pausieren', keys_hint_label: 'P / M', keys_hint_desc: 'P=Pausieren, M=Ton an/aus', close: 'Schließen', press_r_restart: 'Drücke R zum Neustarten', on: 'An', off: 'Aus', move_desc: 'Bewegen (vorwärts/links/rückwärts/rechts)', left_click: 'Linksklick', fire_weapon: 'Feuerwaffe abfeuern', shift_hold: 'Shift (halten)', accel_desc: 'Beschleunigen (Geschwindigkeitsboost)', mouse_aim: 'Maus-Ziel', mouse_aim_desc: 'Zielen mit Maus oder Touch'
    },
    zh: {
  tank_nutz: 'TANK NUTZ', score: '分数', health: '生命', pause: '暂停', resume: '继续', sound: '声音', sound_on: '声音 开', sound_off: '声音 关', controls: '控制', you_died: '你死了', restart: '重新开始', single: '单发', double: '双发', triple: '三发', quad: '四发', controls_title: '控制', right_click_hold: '右键（按住）', pause_vertical_scrolling: '暂停垂直滚动', keys_hint_label: 'P / M', keys_hint_desc: 'P=暂停, M=切换 音效', close: '关闭', press_r_restart: '按 R 重新开始', on: '开', off: '关', move_desc: '移动（前/左/后/右）', left_click: '左键单击', fire_weapon: '开火', shift_hold: 'Shift (按住)', accel_desc: '加速（速度提升）', mouse_aim: '鼠标瞄准', mouse_aim_desc: '用鼠标或触摸瞄准'
    }
  };

  function detectLang(){
    try{
      const nav = navigator && navigator.language ? navigator.language : 'en';
      const code = (''+nav).split('-')[0];
      if (TRANSLATIONS[code]) return code;
    }catch(_){ }
    return 'en';
  }

  // lang selection: prefer persisted user choice, otherwise detect
  const persisted = (function(){ try{ return localStorage && localStorage.getItem && localStorage.getItem('tn_lang'); }catch(_){ return null; } })();
  const lang = persisted || detectLang();

  window.__i18n = { lang, translations: TRANSLATIONS, languages: Object.keys(TRANSLATIONS) };

  window.t = function(key){
    try{
      const tr = window.__i18n && window.__i18n.translations && window.__i18n.translations[window.__i18n.lang];
      if (tr && tr[key]) return tr[key];
      // fallback to english
      const en = window.__i18n.translations.en;
      if (en && en[key]) return en[key];
    }catch(_){ }
    return key;
  };

  // allow UI to change language explicitly
  window.setLang = function(code){ try{ if (!code || !window.__i18n.translations[code]) return false; window.__i18n.lang = code; try{ localStorage && localStorage.setItem && localStorage.setItem('tn_lang', code); }catch(_){ } // notify listeners about lang change
    try{ if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent('tn-lang-changed',{ detail: { lang: code } })); } }catch(_){ }
    return true; }catch(_){ return false; } };
  window.getLang = function(){ try{ return window.__i18n.lang; }catch(_){ return 'en'; } };

})();
