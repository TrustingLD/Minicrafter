// Base commune aux "choses vivantes dans le monde qui ne sont pas des blocs" (Phase 10).
// Avant, Mob.update() portait sa propre copie de la gravité + collision verticale ;
// item-entity.js en a besoin à l'identique. Extraite ici plutôt que recopiée : un seul
// endroit à corriger si la physique change.

import * as THREE from 'three';

const GRAVITY = 20; // unités/s², identique au joueur (main.js) et à l'ancien Mob

export class Entity {
  constructor(x, y, z, { radius, height, collidesAtBox }) {
    this.pos = new THREE.Vector3(x, y, z);
    this.velY = 0;
    this.onGround = false;
    this.radius = radius;
    this.height = height;
    this.collidesAtBox = collidesAtBox;
    this.alive = true;
  }

  // applique gravité + résolution de collision verticale sur un pas de temps dt.
  // Ne touche pas x/z : le déplacement horizontal reste propre à chaque sous-classe
  // (le joueur a un input, un mob erre, un item entity a juste une pop-vélocité).
  applyGravity(dt) {
    this.velY -= GRAVITY * dt;
    const newY = this.pos.y + this.velY * dt;
    if (this.velY < 0) {
      if (this.collidesAtBox(this.pos.x, newY, this.pos.z, this.radius, this.height)) {
        this.velY = 0;
        this.onGround = true;
      } else {
        this.pos.y = newY;
        this.onGround = false;
      }
    } else if (!this.collidesAtBox(this.pos.x, newY, this.pos.z, this.radius, this.height)) {
      this.pos.y = newY;
      this.onGround = false;
    } else {
      this.velY = 0;
    }
  }
}
