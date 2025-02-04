import { Component } from '@angular/core';
import { AdminBoardService } from 'src/app/Services/admin-board.service';

@Component({
  selector: 'app-control-panel',
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.css']
})
export class ControlPanelComponent {
  constructor(private adminBoardService: AdminBoardService) {}

  addStation(stationCode: string, boardConfig: any) {
    this.adminBoardService.addStation(stationCode, boardConfig);
  }

  manualControlBoard(boardId: string, action: string) {
    this.adminBoardService.manualControlBoard(boardId, action);
  }
}
