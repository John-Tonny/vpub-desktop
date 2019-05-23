import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material';

import { Bid } from '../../../../core/market/api/bid/bid.model';
import { BidService } from 'app/core/market/api/bid/bid.service';
import { ListingService } from '../../../../core/market/api/listing/listing.service';

import { ModalsHelperService } from 'app/modals/modals.module';
import { RpcStateService } from 'app/core/rpc/rpc-state/rpc-state.service';
import { SnackbarService } from '../../../../core/snackbar/snackbar.service';

import { PlaceOrderComponent } from '../../../../modals/market-place-order/place-order.component';
import { ShippingComponent } from '../../../../modals/market-shipping/shipping.component';
import { BidConfirmationModalComponent } from 'app/modals/market-bid-confirmation-modal/bid-confirmation-modal.component';
import { ProcessingModalComponent } from 'app/modals/processing-modal/processing-modal.component';

@Component({
  selector: 'app-order-item',
  templateUrl: './order-item.component.html',
  styleUrls: ['./order-item.component.scss']
})
export class OrderItemComponent implements OnInit {

  @Input() order: Bid;
  trackNumber: string;
  country: string = '';
  constructor(
    private listingService: ListingService,
    private bid: BidService,
    private rpcState: RpcStateService,

    // @TODO rename ModalsHelperService to ModalsService after modals service refactoring.
    private modals: ModalsHelperService,
    private dialog: MatDialog,
    private snackbarService: SnackbarService
  ) { }

  ngOnInit() {
    this.getItemDetails();
  }

  getItemDetails() {

    if (!this.order) {
      return;
    }
    this.country = this.order.ShippingAddress.country;
    this.listingService.get(this.order.listingItemId).subscribe(response => {
      this.order.listing = response;
    });
  }

  // Testing of all the scenarios
  order_action() {
    switch (this.order.status) {
      case 'bidding':
        // run accept command for seller
        if (this.order.type === 'sell') {
          this.callBid('accept')
        }
        break;

      case 'awaiting':
        // Escrow lock call with popup
        if (this.order.type === 'buy') {
          this.openPaymentConfirmationModal();
          // this.escrowLock();
        }
        break;

      case 'escrow':
        if (this.order.type === 'sell') {
          this.callBid('shipping');
        }
        break;

      case 'shipping':
        // escrow release call with popup
        if (this.order.type === 'buy') {
          this.callBid('escrow');
        }
        break;

      default:
        break;
    }
  }

  // @TODO: refactor method for all calls
  callBid(type: string) {
    const dialogRef = this.dialog.open(type === 'shipping' ? ShippingComponent : PlaceOrderComponent);
    dialogRef.componentInstance.type = type;
    dialogRef.componentInstance.isConfirmed.subscribe((res: any) => {
      this.trackNumber = res ? res : '';
      this.checkForWallet(type);
    });
  }

  checkForWallet(type: string) {
    this.modals.unlock({timeout: 30}, (status) => {
      this.openProcessingModal();
      this.callAction(type)
    });
  }

  callAction(type: string) {
    if (type === 'accept') {
      this.acceptBid();
    } else if (type === 'reject') {
      this.rejectBid();
    } else {
      // Escrow Release Command
      this.escrowRelease(type);
    }
  }

  acceptBid() {
    this.bid.acceptBidCommand(this.order.id).take(1).subscribe(() => {
      this.snackbarService.open(`接受订单 ${this.order.listing.title}`);
      // Reload same order without calling api
      this.order.OrderItem.status = 'AWAITING_ESCROW';
      this.order = new Bid(this.order, this.order.type);
      this.dialog.closeAll();
    }, (error) => {
      this.dialog.closeAll();
      this.snackbarService.open(`${error}`);
    });
  }

  rejectBid() {
    this.bid.rejectBidCommand(this.order.id).take(1).subscribe(res => {
      this.snackbarService.open(`拒绝订单 ${this.order.listing.title}`);
      this.order.OrderItem.status = 'REJECTED';
      this.order = new Bid(this.order, this.order.type);
      this.dialog.closeAll();
    }, (error) => {
      this.dialog.closeAll();
      this.snackbarService.open(`${error}`);
    });

  }

  escrowRelease(ordStatus: string) {
    this.bid.escrowReleaseCommand(this.order.OrderItem.id, this.trackNumber).take(1).subscribe(res => {
      this.snackbarService.open(`订单 ${this.order.listing.title} 的托管资金已经释放`);
      this.order.OrderItem.status = ordStatus === 'shipping' ? 'SHIPPING' : 'COMPLETE';
      this.order = new Bid(this.order, this.order.type)
      this.dialog.closeAll();
    }, (error) => {
      this.dialog.closeAll();
      this.snackbarService.open(`${error}`);
    });

  }

  openPaymentConfirmationModal() {
    // @TODO need to be sets trasaction fee.
    const dialogRef = this.dialog.open(BidConfirmationModalComponent);

    dialogRef.componentInstance.bidItem = this.order;
    dialogRef.componentInstance.onConfirm.subscribe(() => {
      // do other action after confirm
      this.modals.unlock({timeout: 30}, (status) => {
        this.openProcessingModal();
        this.escrowLock()
      });
    });
  }

  escrowLock() {
    // <orderItemId> <nonce> <memo> , @TODO send nonce ?
    this.bid.escrowLockCommand(this.order.OrderItem.id, null, 'Release the funds').take(1).subscribe(res => {
      this.snackbarService.open(`订单 ${this.order.listing.title} 已经付款`);
      this.order.OrderItem.status = 'ESCROW_LOCKED';
      this.order = new Bid(this.order, this.order.type);
      this.dialog.closeAll();
    }, (error) => {
      this.snackbarService.open(`${error}`);
    });
  }

  getStatusTitle() {
    switch (this.order.status) {
      case 'bidding':
          // run accept command for seller
        if (this.order.type === 'buy') {
          return "等待卖家";
        }
        return "接受/拒绝";

      case 'awaiting':
        if (this.order.type === 'buy') {
          return "待支付订单";
        }
        return "等待支付";

      case 'escrow':
        if (this.order.type === 'buy') {
          return "等待交付";
        }
        return "待发货";

      case 'shipping':
        if (this.order.type === 'buy') {
          return "等待收货";
        }
        return "待买家收货";

      case 'complete':
        if (this.order.type === 'buy') {
          return "购物完成";
        }
        return "订单完成";
    }
  }

  openProcessingModal() {
      const dialog = this.dialog.open(ProcessingModalComponent, {
        disableClose: true,
        data: {
          message: '请稍候，我们正在处理....'
        }
      });
  }

}
