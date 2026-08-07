function codegenNativeComponent(componentName, options) {
  return 'div';
}

function codegenNativeCommands(options) {
  return {};
}

const UIManager = {
  hasViewManagerConfig: function (name) {
    return false;
  },
  getViewManagerConfig: function (name) {
    return null;
  },
  setLayoutAnimationEnabledExperimental: function () {},
};

UIManager.default = UIManager;

try {
  const RNWeb = require('react-native-web');
  if (RNWeb) {
    if (typeof RNWeb.codegenNativeComponent !== 'function') {
      RNWeb.codegenNativeComponent = codegenNativeComponent;
    }
    if (typeof RNWeb.codegenNativeCommands !== 'function') {
      RNWeb.codegenNativeCommands = codegenNativeCommands;
    }
    if (!RNWeb.UIManager) {
      RNWeb.UIManager = UIManager;
    } else {
      if (!RNWeb.UIManager.hasViewManagerConfig) {
        RNWeb.UIManager.hasViewManagerConfig = UIManager.hasViewManagerConfig;
      }
      if (!RNWeb.UIManager.getViewManagerConfig) {
        RNWeb.UIManager.getViewManagerConfig = UIManager.getViewManagerConfig;
      }
      if (!RNWeb.UIManager.setLayoutAnimationEnabledExperimental) {
        RNWeb.UIManager.setLayoutAnimationEnabledExperimental = UIManager.setLayoutAnimationEnabledExperimental;
      }
      if (!RNWeb.UIManager.default) {
        RNWeb.UIManager.default = RNWeb.UIManager;
      }
    }
  }
} catch (e) {
  // Ignore CJS cycle during static rendering
}

module.exports = codegenNativeComponent;
module.exports.default = codegenNativeComponent;
module.exports.codegenNativeComponent = codegenNativeComponent;
module.exports.codegenNativeCommands = codegenNativeCommands;
module.exports.UIManager = UIManager;
