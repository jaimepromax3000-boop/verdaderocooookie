/**
 * I18n: idiomas del juego (español, inglés y francés).
 *
 * El código del juego escribe sus textos en español. Este módulo intercepta Phaser.GameObjects.Text#setText
 * y traduce cada línea con tres niveles: (1) coincidencia exacta del glosario, (2) reglas con números
 * ("Elimina 10 Virus"), (3) segmentos separados por " · ". Así cubre HUD, menús, avisos y etiquetas
 * sin tocar cada llamada. Si una cadena no está en el glosario se muestra en español.
 */
const I18n = {
  cache: { en: new Map(), fr: new Map() },
  installed: false,

  /** Glosario exacto: español -> [inglés, francés]. */
  D: {
    // --- menú ---
    'PARTIDA': ['PLAY', 'PARTIE'], 'TIENDA': ['SHOP', 'BOUTIQUE'], 'HERRERO': ['BLACKSMITH', 'FORGERON'], 'MISIONES': ['MISSIONS', 'MISSIONS'],
    'JUGADOR': ['PLAYER', 'JOUEUR'], 'ARMA': ['WEAPON', 'ARME'], 'DIFICULTAD': ['DIFFICULTY', 'DIFFICULTÉ'], 'JUGAR  [Enter]': ['PLAY  [Enter]', 'JOUER  [Entrée]'],
    'Pulsa en el nombre y escribe (máx. 14 letras). Enter para guardar.': ['Click the name and type (max. 14 letters). Enter to save.', 'Cliquez sur le nom et tapez (14 lettres max.). Entrée pour valider.'],
    'Solo cambia el aspecto, no el juego.\nCompra más skins en la TIENDA o encuéntralas en cofres.': ['Only changes the look, not the game.\nBuy more skins in the SHOP or find them in chests.', 'Ne change que l\'apparence, pas le jeu.\nAchetez des skins en BOUTIQUE ou trouvez-en dans les coffres.'],
    '[borrar todo el progreso]': ['[erase all progress]', '[effacer toute la progression]'], '[¿seguro? pulsa otra vez]': ['[sure? click again]', '[sûr ? recliquez]'],
    'MEJORAS PERMANENTES': ['PERMANENT UPGRADES', 'AMÉLIORATIONS PERMANENTES'], 'SKINS': ['SKINS', 'SKINS'], 'MATERIALES': ['MATERIALS', 'MATÉRIAUX'],
    'Se pagan con ◆ Fragmentos\nde Núcleo (los ganas jugando)': ['Paid with ◆ Core Fragments\n(you earn them by playing)', 'Payées en ◆ Fragments de Noyau\n(gagnés en jouant)'],
    'Se pagan con ¢ monedas,\no salen en los cofres de jefe': ['Paid with ¢ coins,\nor found in boss chests', 'Payées en ¢ pièces,\nou trouvées dans les coffres de boss'],
    'Con ellos el HERRERO\nfabrica tu armadura': ['The BLACKSMITH uses them\nto forge your armor', 'Le FORGERON les utilise\npour forger votre armure'],
    'Pasa el ratón por una mejora para ver qué hace.': ['Hover an upgrade to see what it does.', 'Survolez une amélioration pour voir son effet.'],
    'Pulsa para comprar': ['Click to buy', 'Cliquez pour acheter'], 'Pulsa para equipar': ['Click to equip', 'Cliquez pour équiper'],
    'EQUIPADA': ['EQUIPPED', 'ÉQUIPÉE'], 'Solo en cofres': ['Chests only', 'Coffres uniquement'], 'en curso': ['in progress', 'en cours'],
    'RECLAMAR': ['CLAIM', 'RÉCLAMER'], '¡RECOMPENSA RECLAMADA!': ['REWARD CLAIMED!', 'RÉCOMPENSE RÉCLAMÉE !'], '[clic para cerrar]': ['[click to close]', '[cliquez pour fermer]'],
    'El progreso cuenta entre partidas. Reclama la recompensa al completarlas.': ['Progress carries over between runs. Claim the reward when you finish them.', 'La progression se conserve entre les parties. Réclamez la récompense une fois terminées.'],
    'ARMADURA PERMANENTE': ['PERMANENT ARMOR', 'ARMURE PERMANENTE'], 'TUS MATERIALES': ['YOUR MATERIALS', 'VOS MATÉRIAUX'], 'Compra materiales en la TIENDA': ['Buy materials in the SHOP', 'Achetez des matériaux en BOUTIQUE'],
    'Sin pieza': ['No piece', 'Aucune pièce'], 'ya': ['done', 'déjà'],
    // --- ajustes ---
    'AJUSTES': ['SETTINGS', 'PARAMÈTRES'], 'IDIOMA': ['LANGUAGE', 'LANGUE'], 'VOLUMEN': ['VOLUME', 'VOLUME'], 'CONTROLES': ['CONTROLS', 'COMMANDES'], 'CERRAR': ['CLOSE', 'FERMER'],
    'ESPAÑOL': ['ESPAÑOL', 'ESPAÑOL'], 'ENGLISH': ['ENGLISH', 'ENGLISH'], 'FRANÇAIS': ['FRANÇAIS', 'FRANÇAIS'],
    'ORDENADOR': ['COMPUTER', 'ORDINATEUR'], 'teclado y ratón': ['keyboard and mouse', 'clavier et souris'], 'MÓVIL / TABLET': ['MOBILE / TABLET', 'MOBILE / TABLETTE'], 'táctil con 2 joysticks': ['touch with 2 joysticks', 'tactile avec 2 joysticks'],
    'Modo ordenador: WASD o flechas para moverte, ratón para apuntar y disparar, Espacio/Shift para el dash, Q o clic derecho para la habilidad, E para interactuar.': ['Computer mode: WASD or arrows to move, mouse to aim and shoot, Space/Shift to dash, Q or right click for the ability, E to interact.', 'Mode ordinateur : WASD ou flèches pour bouger, souris pour viser et tirer, Espace/Maj pour l\'esquive, Q ou clic droit pour la capacité, E pour interagir.'],
    'Modo móvil (incluye iPad): joystick izquierdo para moverte, joystick derecho para apuntar y disparar. Botones en pantalla para dash, habilidad, interactuar, pausa y mapa.': ['Mobile mode (includes iPad): left joystick to move, right joystick to aim and shoot. On-screen buttons for dash, ability, interact, pause and map.', 'Mode mobile (iPad inclus) : joystick gauche pour bouger, joystick droit pour viser et tirer. Boutons à l\'écran pour l\'esquive, la capacité, interagir, pause et carte.'],
    // --- armas / personajes / habilidades ---
    'ESTÁNDAR': ['STANDARD', 'STANDARD'], 'LIGERO': ['LIGHT', 'LÉGER'], 'PESADO': ['HEAVY', 'LOURD'], 'Estándar': ['Standard', 'Standard'], 'Ligero': ['Light', 'Léger'], 'Pesado': ['Heavy', 'Lourd'],
    'Equilibrada.': ['Balanced.', 'Équilibrée.'], 'Rápida y frágil.': ['Fast and fragile.', 'Rapide et fragile.'], 'Resistente y lenta.': ['Sturdy and slow.', 'Robuste et lente.'],
    'Pulso EMP': ['EMP Pulse', 'Impulsion EMP'], 'Fase espectral': ['Spectral Phase', 'Phase spectrale'], 'Enjambre': ['Swarm', 'Essaim'],
    'Q · Pulso EMP': ['Q · EMP Pulse', 'Q · Impulsion EMP'], 'Q · Fase espectral': ['Q · Spectral Phase', 'Q · Phase spectrale'], 'Q · Enjambre': ['Q · Swarm', 'Q · Essaim'],
    'Borra balas y aturde a los enemigos cercanos.': ['Wipes bullets and stuns nearby enemies.', 'Efface les balles et étourdit les ennemis proches.'],
    '2,5 s intangible y rápido, con estela de fuego.': ['2.5 s intangible and fast, leaving a fire trail.', '2,5 s intangible et rapide, avec une traînée de feu.'],
    '3 satélites orbitan 8 s: dañan y bloquean balas.': ['3 satellites orbit for 8 s: they damage and block bullets.', '3 satellites en orbite 8 s : ils blessent et bloquent les balles.'],
    'Pulso': ['Pulse', 'Impulsion'], 'Dispersor': ['Scatter', 'Dispersion'], 'Lanza Riel': ['Railgun', 'Canon à rails'],
    'PULSO EMP': ['EMP PULSE', 'IMPULSION EMP'], 'FASE ESPECTRAL': ['SPECTRAL PHASE', 'PHASE SPECTRALE'], 'ENJAMBRE': ['SWARM', 'ESSAIM'],
    '[Q] LISTA': ['[Q] READY', '[Q] PRÊTE'],
    // --- dificultades ---
    'FÁCIL': ['EASY', 'FACILE'], 'NORMAL': ['NORMAL', 'NORMAL'], 'DIFÍCIL': ['HARD', 'DIFFICILE'],
    'Menos enemigos y más débiles. Recompensas x0,7.': ['Fewer, weaker enemies. Rewards x0.7.', 'Moins d\'ennemis, plus faibles. Récompenses x0,7.'],
    'La experiencia equilibrada. Recompensas x1.': ['The balanced experience. Rewards x1.', 'L\'expérience équilibrée. Récompenses x1.'],
    'Enemigos con +45 % de vida y +50 % de daño, más numerosos. Tu vida no cambia. Recompensas x1,7.': ['Enemies with +45 % health and +50 % damage, in greater numbers. Your health does not change. Rewards x1.7.', 'Ennemis avec +45 % de vie et +50 % de dégâts, plus nombreux. Votre vie ne change pas. Récompenses x1,7.'],
    // --- mejoras permanentes ---
    'Núcleo reforzado': ['Reinforced Core', 'Noyau renforcé'], '+1 vida máxima': ['+1 max health', '+1 vie max'], 'Barrera latente': ['Latent Barrier', 'Barrière latente'], '+1 escudo': ['+1 shield', '+1 bouclier'],
    'Autorreparación': ['Self-repair', 'Auto-réparation'], 'El escudo se recarga antes': ['The shield recharges sooner', 'Le bouclier se recharge plus vite'], 'Compilador agresivo': ['Aggressive Compiler', 'Compilateur agressif'], '+10 % de daño': ['+10 % damage', '+10 % de dégâts'],
    'Salto de fase': ['Phase Jump', 'Saut de phase'], '-12 % enfriamiento del dash': ['-12 % dash cooldown', '-12 % de recharge de l\'esquive'], 'Núcleo recargable': ['Rechargeable Core', 'Noyau rechargeable'], '-12 % enfriamiento de la habilidad (Q)': ['-12 % ability cooldown (Q)', '-12 % de recharge de la capacité (Q)'],
    'Overclock motor': ['Engine Overclock', 'Overclock moteur'], '+6 % de velocidad': ['+6 % speed', '+6 % de vitesse'], 'Fondos opacos': ['Dark Funds', 'Fonds occultes'], '+15 créditos iniciales': ['+15 starting credits', '+15 crédits de départ'],
    'Llave maestra': ['Master Key', 'Clé maîtresse'], 'Empiezas con 1 llave': ['Start with 1 key', 'Commencez avec 1 clé'], 'Suerte de sistema': ['System Luck', 'Chance du système'], 'Más recompensas': ['More rewards', 'Plus de récompenses'],
    // --- mejoras de partida (módulos) ---
    'Balas rebotantes': ['Bouncing Bullets', 'Balles rebondissantes'], 'Las balas rebotan 2 veces más en las paredes.': ['Bullets bounce 2 more times off walls.', 'Les balles rebondissent 2 fois de plus sur les murs.'],
    'Rastro incendiario': ['Incendiary Trail', 'Traînée incendiaire'], 'Deja fuego al impactar (siempre al rebotar o al explotar).': ['Leaves fire on impact (always on bounce or explosion).', 'Laisse du feu à l\'impact (toujours au rebond ou à l\'explosion).'],
    'Punta perforante': ['Piercing Tip', 'Pointe perforante'], 'Las balas atraviesan 1 enemigo más.': ['Bullets pierce 1 more enemy.', 'Les balles traversent 1 ennemi de plus.'],
    'Guiado térmico': ['Heat Seeking', 'Guidage thermique'], 'Las balas giran hacia el enemigo más cercano.': ['Bullets curve toward the nearest enemy.', 'Les balles virent vers l\'ennemi le plus proche.'],
    'Overclock de cadencia': ['Fire-rate Overclock', 'Overclock de cadence'], '+25 % de cadencia de disparo.': ['+25 % fire rate.', '+25 % de cadence de tir.'],
    'Carga explosiva': ['Explosive Charge', 'Charge explosive'], 'Los enemigos eliminados explotan.': ['Defeated enemies explode.', 'Les ennemis vaincus explosent.'],
    'Arco voltaico': ['Voltaic Arc', 'Arc voltaïque'], 'Cada impacto salta a un enemigo cercano.': ['Each hit jumps to a nearby enemy.', 'Chaque impact saute vers un ennemi proche.'],
    'Fragmentación': ['Fragmentation', 'Fragmentation'], 'Los enemigos eliminados lanzan 3 fragmentos.': ['Defeated enemies throw 3 fragments.', 'Les ennemis vaincus projettent 3 fragments.'],
    'Munición criogénica': ['Cryogenic Ammo', 'Munitions cryogéniques'], 'Ralentiza a los enemigos alcanzados. Las explosiones les hacen +50 %.': ['Slows enemies hit. Explosions deal +50 % to them.', 'Ralentit les ennemis touchés. Les explosions leur infligent +50 %.'],
    'Virus tóxico': ['Toxic Virus', 'Virus toxique'], 'Envenena: daño continuo durante 3 s (se acumula).': ['Poisons: damage over 3 s (stacks).', 'Empoisonne : dégâts continus pendant 3 s (cumulable).'],
    'Succión de datos': ['Data Siphon', 'Aspiration de données'], '15 % de curar medio corazón al eliminar un enemigo.': ['15 % chance to heal half a heart when defeating an enemy.', '15 % de chance de soigner un demi-cœur en éliminant un ennemi.'],
    'Matriz de escudo': ['Shield Matrix', 'Matrice de bouclier'], '+1 escudo máximo.': ['+1 max shield.', '+1 bouclier max.'],
    'Subida de tensión': ['Power Surge', 'Surtension'], 'Al eliminar un enemigo ganas velocidad 2 s.': ['Defeating an enemy gives you speed for 2 s.', 'Éliminer un ennemi vous donne de la vitesse 2 s.'],
    'Satélites de datos': ['Data Satellites', 'Satellites de données'], 'Un satélite orbita contigo: daña enemigos y bloquea balas.': ['A satellite orbits you: damages enemies and blocks bullets.', 'Un satellite orbite autour de vous : blesse les ennemis et bloque les balles.'],
    'Minas de fase': ['Phase Mines', 'Mines de phase'], 'Cada dash deja una mina que explota al acercarse un enemigo.': ['Each dash leaves a mine that explodes when an enemy gets close.', 'Chaque esquive laisse une mine qui explose au passage d\'un ennemi.'],
    'Núcleo crítico': ['Critical Core', 'Noyau critique'], '+12 % de probabilidad de golpe crítico (daño x2).': ['+12 % critical hit chance (x2 damage).', '+12 % de chance de coup critique (dégâts x2).'],
    'Imán de créditos': ['Credit Magnet', 'Aimant à crédits'], 'Atrae créditos, llaves y corazones desde más lejos.': ['Attracts credits, keys and hearts from farther away.', 'Attire crédits, clés et cœurs de plus loin.'],
    'Onda de choque': ['Shockwave', 'Onde de choc'], 'Cada pocas bajas liberas una onda que daña a tu alrededor.': ['Every few kills you release a wave that damages everything around you.', 'Toutes les quelques éliminations, vous libérez une onde qui blesse autour de vous.'],
    'Eco de dash': ['Dash Echo', 'Écho d\'esquive'], 'El dash deja una estela dañina (con "Rastro incendiario" arde).': ['The dash leaves a damaging trail (burns with "Incendiary Trail").', 'L\'esquive laisse une traînée nocive (brûle avec « Traînée incendiaire »).'],
    'Escudos orbitales': ['Orbital Shields', 'Boucliers orbitaux'], '+1 escudo que orbita a tu alrededor y bloquea 1 bala (se regenera en 10 s).': ['+1 shield orbiting you that blocks 1 bullet (regenerates in 10 s).', '+1 bouclier en orbite qui bloque 1 balle (se régénère en 10 s).'],
    'Cadencia de fuego': ['Fire Rate', 'Cadence de tir'], '+25 % de disparos por segundo.': ['+25 % shots per second.', '+25 % de tirs par seconde.'], 'DOBLE DISPARO: dos balas paralelas.': ['DOUBLE SHOT: two parallel bullets.', 'DOUBLE TIR : deux balles parallèles.'],
    '+25 % más de cadencia.': ['+25 % more fire rate.', '+25 % de cadence en plus.'], 'TRIPLE DISPARO: tres balas paralelas.': ['TRIPLE SHOT: three parallel bullets.', 'TRIPLE TIR : trois balles parallèles.'], 'Cadencia +20 % más: lluvia de balas.': ['Fire rate +20 % more: a rain of bullets.', 'Cadence +20 % de plus : une pluie de balles.'],
    'Más disparos por segundo; en los niveles 2 y 4 se añade una bala más.': ['More shots per second; levels 2 and 4 add one more bullet.', 'Plus de tirs par seconde ; les niveaux 2 et 4 ajoutent une balle.'],
    'Campo de fuerza': ['Force Field', 'Champ de force'], 'Un área a tu alrededor daña a los enemigos que la tocan. Cada nivel la agranda y la hace más dañina.': ['An area around you damages enemies that touch it. Each level enlarges it and makes it deadlier.', 'Une zone autour de vous blesse les ennemis qui la touchent. Chaque niveau l\'agrandit et la rend plus dangereuse.'],
    'Sobrecarga de daño': ['Damage Overload', 'Surcharge de dégâts'], '+18 % de daño en todos tus ataques.': ['+18 % damage on all your attacks.', '+18 % de dégâts sur toutes vos attaques.'],
    'Nanobots reparadores': ['Repair Nanobots', 'Nanobots réparateurs'], 'Al limpiar una sala recuperas medio corazón por nivel.': ['Clearing a room restores half a heart per level.', 'Nettoyer une salle restaure un demi-cœur par niveau.'],
    'Núcleo ampliado': ['Expanded Core', 'Noyau élargi'], '+1 vida máxima y te cura 1 corazón.': ['+1 max health and heals 1 heart.', '+1 vie max et soigne 1 cœur.'],
    'Servomotores': ['Servomotors', 'Servomoteurs'], '+8 % de velocidad de movimiento.': ['+8 % movement speed.', '+8 % de vitesse de déplacement.'],
    'Fase aleatoria': ['Random Phase', 'Phase aléatoire'], '8 % de probabilidad por nivel de esquivar un golpe.': ['8 % chance per level to dodge a hit.', '8 % de chance par niveau d\'esquiver un coup.'],
    'Espinas de datos': ['Data Thorns', 'Épines de données'], 'Al recibir un golpe liberas una onda que daña a los enemigos cercanos.': ['When hit you release a wave that damages nearby enemies.', 'Quand vous êtes touché, vous libérez une onde qui blesse les ennemis proches.'],
    'Campo temporal': ['Time Field', 'Champ temporel'], 'Las balas enemigas cercanas van más lentas (-25 % por nivel).': ['Nearby enemy bullets move slower (-25 % per level).', 'Les balles ennemies proches sont plus lentes (-25 % par niveau).'],
    'Dash afilado': ['Sharp Dash', 'Esquive affûtée'], '-20 % de enfriamiento del dash.': ['-20 % dash cooldown.', '-20 % de recharge de l\'esquive.'],
    'Reciclaje de habilidad': ['Ability Recycling', 'Recyclage de capacité'], '-15 % de enfriamiento de tu habilidad (Q).': ['-15 % cooldown on your ability (Q).', '-15 % de recharge de votre capacité (Q).'],
    'NUEVA': ['NEW', 'NOUVELLE'], 'ELIGE UNA MEJORA': ['CHOOSE AN UPGRADE', 'CHOISISSEZ UNE AMÉLIORATION'], 'SALA LIMPIA': ['ROOM CLEARED', 'SALLE NETTOYÉE'],
    // --- skins ---
    'Operador': ['Operator', 'Opérateur'], 'Virus': ['Virus', 'Virus'], 'Pirata': ['Pirate', 'Pirate'], 'Vikingo': ['Viking', 'Viking'], 'Robot': ['Robot', 'Robot'], 'Ninja': ['Ninja', 'Ninja'], 'Astronauta': ['Astronaut', 'Astronaute'],
    'Alien': ['Alien', 'Alien'], 'Esqueleto': ['Skeleton', 'Squelette'], 'Samurái': ['Samurai', 'Samouraï'], 'Mago': ['Wizard', 'Magicien'], 'Titán dorado': ['Golden Titan', 'Titan doré'],
    'común': ['common', 'commune'], 'rara': ['rare', 'rare'], 'épica': ['epic', 'épique'], 'legendaria': ['legendary', 'légendaire'], 'skin común': ['common skin', 'skin commune'], 'skin rara': ['rare skin', 'skin rare'], 'skin épica': ['epic skin', 'skin épique'], 'skin legendaria': ['legendary skin', 'skin légendaire'],
    // --- armadura ---
    'Cuero polimérico': ['Polymer Leather', 'Cuir polymère'], 'Hierro binario': ['Binary Iron', 'Fer binaire'], 'Oro cifrado': ['Encrypted Gold', 'Or chiffré'], 'Diamante cuántico': ['Quantum Diamond', 'Diamant quantique'],
    'Casco': ['Helmet', 'Casque'], 'Pechera': ['Chestplate', 'Plastron'], 'Pantalones': ['Leggings', 'Jambières'], 'Botas': ['Boots', 'Bottes'],
    'casco': ['helmet', 'casque'], 'pechera': ['chestplate', 'plastron'], 'pantalones': ['leggings', 'jambières'], 'botas': ['boots', 'bottes'],
    '¡Bienvenido a mi forja virtual! Dame materiales y dime qué pieza quieres. Cuanto mejor el material, más te protege.': ['Welcome to my virtual forge! Give me materials and tell me which piece you want. The better the material, the more it protects you.', 'Bienvenue dans ma forge virtuelle ! Donnez-moi des matériaux et dites-moi quelle pièce vous voulez. Meilleur est le matériau, plus il vous protège.'],
    '¡Clang! ¡Clang! Forjando…': ['Clang! Clang! Forging…', 'Clang ! Clang ! Forgeage…'],
    // --- partida / HUD ---
    'NEON LABYRINTH': ['NEON LABYRINTH', 'NEON LABYRINTH'], 'PAUSA': ['PAUSE', 'PAUSE'], 'ESC para continuar': ['ESC to continue', 'Échap pour continuer'],
    'LLAVES': ['KEYS', 'CLÉS'], 'Sala de inicio': ['Starting room', 'Salle de départ'], 'Sala segura': ['Safe room', 'Salle sûre'], 'Combate': ['Combat', 'Combat'], 'Tesoro oculto': ['Hidden treasure', 'Trésor caché'], 'Jefe': ['Boss', 'Boss'],
    'Inicio': ['Start', 'Départ'], 'Tesoro (llave)': ['Treasure (key)', 'Trésor (clé)'], 'Suelta Tab para volver': ['Release Tab to return', 'Relâchez Tab pour revenir'],
    'Reparación': ['Repair', 'Réparation'], 'Llave': ['Key', 'Clé'], '[E] abrir': ['[E] open', '[E] ouvrir'],
    'Créditos insuficientes': ['Not enough credits', 'Crédits insuffisants'], 'Necesitas una llave': ['You need a key', 'Il faut une clé'], 'Puerta abierta': ['Door opened', 'Porte ouverte'],
    '¡CRÍTICO!': ['CRITICAL!', 'CRITIQUE !'], 'ESQUIVA': ['DODGE', 'ESQUIVE'], 'ÉLITE ELIMINADO': ['ELITE DEFEATED', 'ÉLITE ÉLIMINÉ'], 'SERVIDOR PURGADO': ['SERVER PURGED', 'SERVEUR PURGÉ'], '¡Abre antes el cofre!': ['Open the chest first!', 'Ouvrez d\'abord le coffre !'],
    'CONEXIÓN PERDIDA': ['CONNECTION LOST', 'CONNEXION PERDUE'], 'SERVIDOR CONQUISTADO': ['SERVER CONQUERED', 'SERVEUR CONQUIS'],
    '[ Enter ]  Volver al menú': ['[ Enter ]  Back to menu', '[ Entrée ]  Retour au menu'], '[Enter / clic]  Continuar': ['[Enter / click]  Continue', '[Entrée / clic]  Continuer'],
    'Pierdes las mejoras de esta partida;': ['You lose this run\'s upgrades;', 'Vous perdez les améliorations de cette partie ;'], 'conservas fragmentos, monedas y misiones.': ['you keep fragments, coins and missions.', 'vous gardez fragments, pièces et missions.'],
    // --- temas, jefes, enemigos ---
    'SERVIDORES': ['SERVERS', 'SERVEURS'], 'RED NEURONAL': ['NEURAL NETWORK', 'RÉSEAU NEURONAL'], 'NÚCLEO CENTRAL': ['CENTRAL CORE', 'NOYAU CENTRAL'], 'CIUDAD NEÓN': ['NEON CITY', 'VILLE NÉON'], 'OCÉANO DE DATOS': ['DATA OCEAN', 'OCÉAN DE DONNÉES'], 'EL VACÍO': ['THE VOID', 'LE VIDE'],
    'Guardián del Servidor': ['Server Guardian', 'Gardien du Serveur'], 'Hidra de Datos': ['Data Hydra', 'Hydre de Données'], 'Núcleo Corrupto': ['Corrupted Core', 'Noyau Corrompu'], 'Centinela Prisma': ['Prism Sentinel', 'Sentinelle Prisme'], 'Coloso de Hierro': ['Iron Colossus', 'Colosse de Fer'], 'Emperador del Vacío': ['Void Emperor', 'Empereur du Vide'],
    'Centinelas': ['Sentinels', 'Sentinelles'], 'Invocadores': ['Summoners', 'Invocateurs'], 'Francotiradores': ['Snipers', 'Tireurs d\'élite'], 'Blindados': ['Armored units', 'Blindés'], 'Bombas lógicas': ['Logic bombs', 'Bombes logiques'], 'Espectros': ['Specters', 'Spectres'], 'Fractales': ['Fractals', 'Fractals'], 'Torretas': ['Turrets', 'Tourelles'], 'Drones': ['Drones', 'Drones'],
    'enemigos': ['enemies', 'ennemis'], 'élites': ['elites', 'élites'],
    'Cofre de Bronce': ['Bronze Chest', 'Coffre de bronze'], 'Cofre de Plata': ['Silver Chest', 'Coffre d\'argent'], 'Cofre de Oro': ['Gold Chest', 'Coffre d\'or'],
    'COFRE DE BRONCE': ['BRONZE CHEST', 'COFFRE DE BRONZE'], 'COFRE DE PLATA': ['SILVER CHEST', 'COFFRE D\'ARGENT'], 'COFRE DE ORO': ['GOLD CHEST', 'COFFRE D\'OR'],
    'Derrota a un jefe': ['Defeat a boss', 'Battez un boss'],
    'Armadura': ['Armor', 'Armure'], 'Tienda': ['Shop', 'Boutique'],
    'Centinela': ['Sentinel', 'Sentinelle'], 'Invocador': ['Summoner', 'Invocateur'], 'Dron': ['Drone', 'Drone'], 'Francotirador': ['Sniper', 'Tireur d\'élite'], 'Blindado': ['Armored', 'Blindé'], 'Bomba lógica': ['Logic Bomb', 'Bombe logique'],
    'Torreta': ['Turret', 'Tourelle'], 'Espectro': ['Specter', 'Spectre'], 'Fractal': ['Fractal', 'Fractal'], 'Fragmento': ['Fragment', 'Fragment'], 'Guardián': ['Guardian', 'Gardien'], 'Veloz': ['Swift', 'Rapide'], 'Volátil': ['Volatile', 'Volatil'],
    'Cadencia alta, daño medio.': ['High fire rate, medium damage.', 'Cadence élevée, dégâts moyens.'], 'Ráfaga de 5 perdigones.': ['Burst of 5 pellets.', 'Rafale de 5 plombs.'], 'Lenta, atraviesa enemigos.': ['Slow, pierces enemies.', 'Lent, traverse les ennemis.'],
    'DASH': ['DASH', 'ESQ.'], 'MAP': ['MAP', 'CARTE'], 'Bronce': ['Bronze', 'Bronze'], 'Plata': ['Silver', 'Argent'], 'Oro': ['Gold', 'Or'],
    'Pulsa en el nombre y escribe (máx. 14 letras). Enter para guardar.': ['Click the name and type (max. 14 letters). Enter to save.', 'Cliquez sur le nom et tapez (14 lettres max.). Entrée pour valider.'],
    'Cofre de Bronce:': ['Bronze Chest:', 'Coffre de bronze :'], 'Cofre de Plata:': ['Silver Chest:', 'Coffre d\'argent :'], 'Cofre de Oro:': ['Gold Chest:', 'Coffre d\'or :'],
  },

  /** Reglas con números y partes variables. tg = grupos que se traducen por separado. */
  R: [
    [/^(.+) M[kK] II$/, '$1 Mk II', '$1 Mk II', [1]],
    [/^Elimina (\d+) enemigos$/, 'Defeat $1 enemies', 'Éliminez $1 ennemis'], [/^Elimina (\d+) élites$/, 'Defeat $1 elites', 'Éliminez $1 élites'],
    [/^Elimina (\d+) (.+)$/, 'Defeat $1 $2', 'Éliminez $1 $2', [2]],
    [/^Limpia (\d+) salas$/, 'Clear $1 rooms', 'Nettoyez $1 salles'], [/^Derrota a (\d+) jefes$/, 'Defeat $1 bosses', 'Battez $1 boss'],
    [/^Usa tu habilidad (\d+) veces$/, 'Use your ability $1 times', 'Utilisez votre capacité $1 fois'], [/^Recoge (\d+) créditos en partidas$/, 'Collect $1 credits in runs', 'Récoltez $1 crédits en partie'],
    [/^Llega a la planta (\d+)$/, 'Reach floor $1', 'Atteignez l\'étage $1'], [/^Elige (\d+) mejoras de sala$/, 'Pick $1 room upgrades', 'Choisissez $1 améliorations de salle'],
    [/^Completa una partida en (.+)$/, 'Complete a run on $1', 'Terminez une partie en $1', [1]],
    [/^Recompensa: (.+)$/, 'Reward: $1', 'Récompense : $1', [1]], [/^Mejora permanente: (.+) \(Nv (\d+)\)$/, 'Permanent upgrade: $1 (Lv $2)', 'Amélioration permanente : $1 (Niv $2)', [1]],
    [/^Skin: (.+) \((.+)\)$/, 'Skin: $1 ($2)', 'Skin : $1 ($2)', [1, 2]], [/^(\d+) monedas extra$/, '$1 extra coins', '$1 pièces en plus'], [/^(\d+) monedas$/, '$1 coins', '$1 pièces'],
    [/^(\d+) Fragmentos de Núcleo$/, '$1 Core Fragments', '$1 Fragments de Noyau'], [/^\+(\d+) monedas$/, '+$1 coins', '+$1 pièces'], [/^\+(\d+) fragmentos$/, '+$1 fragments', '+$1 fragments'],
    [/^¢ (\d+) monedas$/, '¢ $1 coins', '¢ $1 pièces'], [/^◆ (\d+) fragmentos$/, '◆ $1 fragments', '◆ $1 fragments'], [/^LLAVES (\d+)$/, 'KEYS $1', 'CLÉS $1'],
    [/^Nv (\d+)\/(\d+)$/, 'Lv $1/$2', 'Niv $1/$2'], [/^Nv (\d+)\/(\d+) · (\d+) ◆$/, 'Lv $1/$2 · $3 ◆', 'Niv $1/$2 · $3 ◆'], [/^NIVEL (\d+)\/(\d+) · MAX$/, 'LEVEL $1/$2 · MAX', 'NIVEAU $1/$2 · MAX'], [/^NIVEL (\d+)\/(\d+)$/, 'LEVEL $1/$2', 'NIVEAU $1/$2'],
    [/^(.+) Nv (\d+)$/, '$1 Lv $2', '$1 Niv $2', [1]],
    [/^Prot\. (.+)$/, 'Prot. $1', 'Prot. $1'], [/^Cuesta (\d+) u\.$/, 'Costs $1 u.', 'Coûte $1 u.'], [/^Protección: (.+) puntos$/, 'Protection: $1 points', 'Protection : $1 points'], [/^Daño recibido: (.+)$/, 'Damage taken: $1', 'Dégâts subis : $1'],
    [/^Armadura (.+) %$/, 'Armor $1 %', 'Armure $1 %'],
    [/^Nivel de protección x(\d+)$/, 'Protection level x$1', 'Niveau de protection x$1'], [/^Precio: (\d+) ¢ por unidad$/, 'Price: $1 ¢ each', 'Prix : $1 ¢ l\'unité'], [/^Tienes: (\d+)$/, 'You have: $1', 'Vous avez : $1'],
    [/^Te faltan (\d+) ¢$/, 'You need $1 more ¢', 'Il vous manque $1 ¢'],
    [/^Salas: (\d+)$/, 'Rooms: $1', 'Salles : $1'], [/^Mejoras: (\d+)$/, 'Upgrades: $1', 'Améliorations : $1'], [/^Fragmentos al morir: (.+)$/, 'Fragments on death: $1', 'Fragments à la mort : $1'],
    [/^Mejor planta: (\d+)$/, 'Best floor: $1', 'Meilleur étage : $1'], [/^Salas \(récord\): (\d+)$/, 'Rooms (record): $1', 'Salles (record) : $1'], [/^Victorias: (\d+)$/, 'Wins: $1', 'Victoires : $1'], [/^Partidas: (\d+)$/, 'Runs: $1', 'Parties : $1'],
    [/^Totales: (\d+) bajas$/, 'Totals: $1 kills', 'Totaux : $1 éliminations'], [/^(\d+) salas limpiadas$/, '$1 rooms cleared', '$1 salles nettoyées'], [/^(\d+) jefes$/, '$1 bosses', '$1 boss'], [/^(\d+) cofres abiertos$/, '$1 chests opened', '$1 coffres ouverts'],
    [/^PLANTA (\d+)\/(\d+)$/, 'FLOOR $1/$2', 'ÉTAGE $1/$2'], [/^PLANTA (\d+)$/, 'FLOOR $1', 'ÉTAGE $1'], [/^PLANTA (\d+) · (.+)$/, 'FLOOR $1 · $2', 'ÉTAGE $1 · $2', [2]],
    [/^OLEADA (\d+)\/(\d+)$/, 'WAVE $1/$2', 'VAGUE $1/$2'], [/^FASE (\d+)$/, 'PHASE $1', 'PHASE $1'], [/^JEFE$/, 'BOSS', 'BOSS'], [/^MISIÓN COMPLETADA$/, 'MISSION COMPLETE', 'MISSION ACCOMPLIE'],
    [/^¡(.+) SE ENFURECE!$/, '$1 ENRAGES!', '$1 SE DÉCHAÎNE !', [1]], [/^\[Q\] (\d+\.\d)s$/, '[Q] $1s', '[Q] $1s'],
    [/^dificultad (.+)$/, 'difficulty $1', 'difficulté $1', [1]],
    [/^Planta alcanzada: (\d+)\/(\d+)$/, 'Floor reached: $1/$2', 'Étage atteint : $1/$2'], [/^Salas limpiadas: (\d+)$/, 'Rooms cleared: $1', 'Salles nettoyées : $1'], [/^Enemigos eliminados: (\d+)$/, 'Enemies defeated: $1', 'Ennemis éliminés : $1'],
    [/^Fragmentos de Núcleo: (.+)$/, 'Core Fragments: $1', 'Fragments de Noyau : $1'], [/^\(total (\d+)\)$/, '(total $1)', '(total $1)'], [/^Monedas: (.+)$/, 'Coins: $1', 'Pièces : $1'],
    // herrero (frases con partes variables)
    [/^Recibido: (\d+) de (.+)\. ¡Voy a forjar tu (.+)!$/, 'Received: $1 of $2. I\'ll forge your $3!', 'Reçu : $1 de $2. Je vais forger votre $3 !', [2, 3]],
    [/^¡Listo! Aquí tienes tu (.+) de (.+)\. ¡Te sienta genial!$/, 'Done! Here is your $1 of $2. It looks great on you!', 'Voilà ! Votre $1 en $2. Il vous va à merveille !', [1, 2]],
    [/^¡Listo! Pieza equipada: (.+) de (.+)\. ¿Algo más\?$/, 'Done! Piece equipped: $1 of $2. Anything else?', 'Terminé ! Pièce équipée : $1 en $2. Autre chose ?', [1, 2]],
    [/^Tu (.+) ya es de ese material o mejor\. Elige un material superior\.$/, 'Your $1 is already that material or better. Choose a superior material.', 'Votre $1 est déjà de ce matériau ou mieux. Choisissez un matériau supérieur.', [1]],
    [/^Te faltan materiales: (.+) de (.+) necesita (\d+) unidades\. Cómpralas en la TIENDA\.$/, 'Missing materials: $1 of $2 needs $3 units. Buy them in the SHOP.', 'Matériaux manquants : $1 en $2 demande $3 unités. Achetez-les en BOUTIQUE.', [1, 2]],
  ],

  /** Idioma activo. */
  get lang() { return (typeof Settings !== 'undefined' && Settings.lang) || 'es'; },

  /** Activa el parche de Phaser (una vez) y limpia la caché al cambiar de idioma. */
  apply() {
    this.cache = { en: new Map(), fr: new Map() };
    this.translatePage();
    if (this.installed || typeof Phaser === 'undefined') return;
    this.installed = true;
    const orig = Phaser.GameObjects.Text.prototype.setText;
    Phaser.GameObjects.Text.prototype.setText = function (v) {
      if (I18n.lang !== 'es') v = I18n.tr(Array.isArray(v) ? v.join('\n') : v);
      return orig.call(this, v);
    };
  },

  idx() { return this.lang === 'en' ? 0 : 1; },

  /** Pie de la página web (fuera del juego): se guarda el original en español y se traduce. */
  FOOT: {
    en: '<kbd>WASD</kbd> · mouse · <kbd>Space</kbd> dash · <kbd>Q</kbd> ability · <kbd>E</kbd> interact · <kbd>Tab</kbd> map · gear ⚙ = language, volume and touch controls. Click the game and press <kbd>Enter</kbd> to start.',
    fr: '<kbd>WASD</kbd> · souris · <kbd>Espace</kbd> esquive · <kbd>Q</kbd> capacité · <kbd>E</kbd> interagir · <kbd>Tab</kbd> carte · engrenage ⚙ = langue, volume et commandes tactiles. Cliquez sur le jeu et appuyez sur <kbd>Entrée</kbd> pour commencer.',
  },
  translatePage() {
    if (typeof document === 'undefined') return;
    const f = document.querySelector('footer');
    if (f) { if (f.dataset.es === undefined) f.dataset.es = f.innerHTML; f.innerHTML = this.lang === 'es' ? f.dataset.es : this.FOOT[this.lang]; }
    document.documentElement.lang = this.lang;
  },

  /** Nombre por defecto del jugador según el idioma (los nombres elegidos por el jugador no se traducen). */
  playerName(name) { return name === 'Operador' ? this.tr('Operador') : '\u2060' + name; },

  /** Traduce un texto (varias líneas) al idioma activo. */
  tr(str) {
    const L = this.lang;
    if (L === 'es' || typeof str !== 'string' || !str) return str;
    const c = this.cache[L];
    let out = c.get(str);
    if (out === undefined) {
      const whole = this.D[str];                                         // cadenas con saltos de línea del glosario
      out = whole ? whole[this.idx()] : str.split('\n').map(l => this.line(l)).join('\n');
      c.set(str, out);
    }
    return out;
  },

  /** Una línea: coincidencia exacta, regla o segmentos separados por " · " / espacios largos. */
  line(l) {
    if (!/[A-Za-zÁ-ú]/.test(l)) return l;
    const whole = this.piece(l, true);
    if (whole !== null) return whole;
    const parts = l.split(/(\s*·\s*|\s{3,})/);
    if (parts.length > 1) return parts.map((p, i) => (i % 2 ? p : (this.piece(p, false) ?? p))).join('');
    return this.piece(l, false) ?? l;
  },

  /** Traduce un fragmento; devuelve null si no hay coincidencia (y strict). */
  piece(p, strict) {
    const k = this.idx();
    const t = p.trim();
    if (!t) return p;
    if (t.charAt(0) === '\u2060') return p;                             // nombre de jugador: no se traduce
    const lead = p.match(/^\s*/)[0], trail = p.match(/\s*$/)[0];
    const wrap = s => lead + s + trail;
    const hit = this.D[t];
    if (hit) return wrap(hit[k]);
    for (const r of this.R) {                                            // reglas con números
      const m = t.match(r[0]);
      if (!m) continue;
      let tpl = r[1 + k];
      const tg = r[3] || [];
      tpl = tpl.replace(/\$(\d)/g, (_, n) => { const g = m[+n]; return tg.includes(+n) ? this.sub(g) : g; });
      return wrap(tpl);
    }
    // todo en mayúsculas: busca la versión en minúsculas del glosario (p. ej. nombres de jefe en avisos)
    if (t === t.toUpperCase()) {
      const low = this.lookupLower(t);
      if (low) return wrap(low[k].toUpperCase());
    }
    return strict ? null : null;
  },

  /** Traduce un grupo capturado (nombre, pieza...). Si no se conoce se deja igual. */
  sub(g) {
    const k = this.idx();
    const t = g.trim();
    const hit = this.D[t];
    if (hit) return hit[k];
    const low = this.lookupLower(t);
    if (low) return t === t.toUpperCase() ? low[k].toUpperCase() : low[k];
    return this.line(g);
  },

  lookupLower(t) {
    if (!this._low) { this._low = new Map(); for (const [es, v] of Object.entries(this.D)) this._low.set(es.toLowerCase(), v); }
    return this._low.get(t.toLowerCase()) || null;
  },
};
