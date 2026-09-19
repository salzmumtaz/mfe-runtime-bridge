import { Component } from '@angular/core';
import type { Routes } from '@angular/router';

@Component({ standalone: true, template: '' })
class RoutePlaceholderComponent {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'studio' },
  { path: '**', component: RoutePlaceholderComponent },
];
