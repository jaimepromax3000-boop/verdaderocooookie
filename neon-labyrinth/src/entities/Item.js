/**
 * Item: objetos interactivos de la sala: créditos, corazones, llaves, módulos de software,
 * armas iniciales, objetos de tienda (con precio) y el portal a la siguiente planta.
 * Las monedas, corazones y llaves se recogen al tocarlos; módulos, armas y compras con la tecla E.
 */
class Item extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, kind, data = {}) {
    super(scene, x, y, kind === 'chest' ? 'chest_' + (data.tier || 1) : Item.textureFor(kind));
    scene.add.existing(this);
    this.gs = scene;
    this.kind = kind;                 // coin | heart | key | module | weapon | portal
    this.data2 = data;                // { id, price, group }
    this.price = data.price || 0;
    this.baseY = y;
    this.t = Math.random() * 6;
    this.collected = false;
    this.setDepth(5);
    this.label = null;
    const tint = Item.tintFor(kind, data);
    if (tint !== null) this.setTint(tint);
    if (kind === 'module' || kind === 'weapon' || kind === 'portal') this.setScale(1.2);
    if (kind === 'chest') this.setScale(1.3);
    if (kind === 'module' || kind === 'weapon' || kind === 'chest' || this.price) {
      const name = kind === 'chest' ? `Cofre de ${CHEST_TIERS[(data.tier || 1) - 1].name}\n[E] abrir` : kind === 'module' ? Modules.defs[data.id].name : kind === 'weapon' ? WEAPONS[data.id].name : kind === 'heart' ? 'Reparación' : kind === 'key' ? 'Llave' : '';
      this.label = scene.add.text(x, y + 24, (name + (this.price ? '\n' + this.price + '¢' : '')).trim(), {
        fontFamily: 'monospace', fontSize: '12px', color: '#cffcff', stroke: '#001018', strokeThickness: 3, align: 'center',
      }).setOrigin(0.5).setDepth(6);
    }
  }

  static textureFor(kind) {
    return { coin: 'coin', heart: 'heart', key: 'key', module: 'module', weapon: 'weapon', portal: 'portal' }[kind] || 'coin';
  }

  static tintFor(kind, data) {
    if (kind === 'module') return Modules.defs[data.id].color;
    if (kind === 'weapon') return WEAPONS[data.id].color;
    return null;
  }

  /** ¿Se recoge solo al tocarlo? */
  get auto() { return !this.price && (this.kind === 'coin' || this.kind === 'heart' || this.kind === 'key'); }

  update(dt) {
    this.t += dt;
    this.y = this.baseY + Math.sin(this.t * 3) * 2.5;
    if (this.kind === 'portal') this.setRotation(this.t * 1.5);
    if (this.label) this.label.setPosition(this.x, this.baseY + 24);
  }

  remove() {
    this.collected = true;
    if (this.label) this.label.destroy();
    this.destroy();
  }
}
