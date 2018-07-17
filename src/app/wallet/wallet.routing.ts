import { ModuleWithProviders } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { OverviewComponent } from './overview/overview.component';
import { SettingsComponent } from './settings/settings.component';
import { ReceiveComponent, SendComponent, HistoryComponent, AddressBookComponent } from './wallet/wallet.module';
import { MainRouter } from 'app/core-ui/main/main.router';

//   { path: '', redirectTo: '/wallet/overview', pathMatch: 'full' },
export const wallet_routes_children =
  [
    { path: '', redirectTo: 'overview', pathMatch: 'full' },
    { path: 'overview', component: OverviewComponent, data: { title: 'Overview' } },
    { path: 'receive', component: ReceiveComponent, data: { title: 'Receive' } },
    { path: 'send', component: SendComponent, data: { title: 'Send' } },
    { path: 'history', component: HistoryComponent, data: { title: 'History' } },
    { path: 'address-book', component: AddressBookComponent, data: { title: 'Address Book' } }
  ];

