// Options du générateur de plan alimentaire (partagées entre l'écran et la fonction serveur /api/meal-plan).
export const ALLERGENS = [
  { key: 'gluten', label: 'Gluten', emoji: '🌾', words: ['blé', 'ble ', 'farine', 'pain', 'pâtes', 'pates', 'semoule', 'boulgour', 'seigle', 'orge', 'épeautre', 'couscous', 'chapelure', 'biscotte', 'tortilla', 'wrap', 'gluten', 'muesli', 'granola'] },
  { key: 'lait', label: 'Lait / lactose', emoji: '🥛', words: ['lait', 'fromage', 'yaourt', 'yogourt', 'beurre', 'crème', 'creme', 'mozzarella', 'parmesan', 'feta', 'skyr', 'ricotta', 'emmental', 'comté', 'cottage', 'whey', 'lactosérum', 'faisselle'] },
  { key: 'oeufs', label: 'Œufs', emoji: '🥚', words: ['œuf', 'oeuf', 'mayonnaise', 'omelette'] },
  { key: 'arachides', label: 'Arachides', emoji: '🥜', words: ['arachide', 'cacahuète', 'cacahuete', 'beurre de cacahu'] },
  { key: 'fruits_coque', label: 'Fruits à coque', emoji: '🌰', words: ['amande', 'noix', 'noisette', 'cajou', 'pistache', 'pécan', 'pecan', 'macadamia', 'praliné'] },
  { key: 'poisson', label: 'Poisson', emoji: '🐟', words: ['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'sardine', 'maquereau', 'truite', 'merlu', 'anchois', 'dorade', 'bar ', 'lieu'] },
  { key: 'crustaces', label: 'Crustacés', emoji: '🦐', words: ['crevette', 'crabe', 'homard', 'langoust', 'gambas', 'écrevisse'] },
  { key: 'mollusques', label: 'Mollusques', emoji: '🦪', words: ['moule', 'huître', 'huitre', 'calamar', 'seiche', 'poulpe', 'coquille saint', 'saint-jacques', 'encornet'] },
  { key: 'soja', label: 'Soja', emoji: '🫘', words: ['soja', 'tofu', 'tempeh', 'edamame', 'miso', 'sauce soja', 'tamari'] },
  { key: 'sesame', label: 'Sésame', emoji: '⚪', words: ['sésame', 'sesame', 'tahini', 'tahin', 'houmous', 'hummus'] },
  { key: 'celeri', label: 'Céleri', emoji: '🥬', words: ['céleri', 'celeri'] },
  { key: 'moutarde', label: 'Moutarde', emoji: '🟡', words: ['moutarde'] },
  { key: 'sulfites', label: 'Sulfites', emoji: '🍷', words: ['vin', 'vinaigre de vin', 'fruits secs sulfités'] },
  { key: 'lupin', label: 'Lupin', emoji: '🌼', words: ['lupin'] },
]

export const EQUIPMENT = [
  { key: 'plaques', label: 'Plaques / poêle', emoji: '🍳' },
  { key: 'four', label: 'Four', emoji: '🔥' },
  { key: 'micro_ondes', label: 'Micro-ondes', emoji: '📦' },
  { key: 'airfryer', label: 'Air fryer', emoji: '🌀' },
  { key: 'mixeur', label: 'Mixeur / blender', emoji: '🥤' },
  { key: 'robot', label: 'Robot cuiseur', emoji: '🤖' },
  { key: 'vapeur', label: 'Cuiseur vapeur', emoji: '♨️' },
  { key: 'autocuiseur', label: 'Autocuiseur', emoji: '🍲' },
  { key: 'barbecue', label: 'Barbecue / plancha', emoji: '🔥' },
  { key: 'bouilloire', label: 'Bouilloire', emoji: '🫖' },
]

export const DIETS = [
  { key: 'omnivore', label: 'Je mange de tout' },
  { key: 'sans_porc', label: 'Sans porc' },
  { key: 'halal', label: 'Halal' },
  { key: 'pescetarien', label: 'Pescétarien' },
  { key: 'vegetarien', label: 'Végétarien' },
  { key: 'vegan', label: 'Végétalien (vegan)' },
]

export const DAY_OPTIONS = [1, 3, 7]
export const MEALS_OPTIONS = [3, 4, 5]
