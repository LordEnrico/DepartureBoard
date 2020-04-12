import { Component, ViewChild, ComponentFactoryResolver, ViewContainerRef, ComponentRef, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, UrlTree, UrlSegmentGroup, PRIMARY_OUTLET, UrlSegment, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Board } from './board/board';
import { ServiceStatus } from '../singleboard/singleboard'
import { ToggleConfig } from '../ToggleConfig';
import { GoogleAnalyticsEventsService } from '../Services/google.analytics';

@Component({
  selector: 'app-boards',
  templateUrl: './boards.component.html',
  styleUrls: ['./boards.styling.css']
})
export class BoardsComponent implements OnDestroy {
  private headers = new HttpHeaders().set('Content-Type', "application/json");
  time = new Date();
  refresher;
  noBoardsDisplay: boolean = false;
  useArrivals: boolean = false;
	public displays: number = 6;
	public platform: number;
  public stationCode: string = "EUS";
  @ViewChild('Boards', { read: ViewContainerRef, static: false }) Boards: ViewContainerRef;
  private boardsRefs: Array<ComponentRef<Board>> = new Array<ComponentRef<Board>>();

  constructor(private http: HttpClient, private route: ActivatedRoute, private datePipe: DatePipe, private resolver: ComponentFactoryResolver, private router: Router, public googleAnalyticsEventsService: GoogleAnalyticsEventsService) {
    setInterval(() => {
      this.time = new Date();
    }, 1000);

    route.params.subscribe(() => {
      route.queryParams.subscribe(queryParams => {
        this.SetupBoard(queryParams);
		  })});
  }

  SetupBoard(queryParams) {
    const s: UrlSegment[] = this.router.parseUrl(this.router.url).root.children[PRIMARY_OUTLET].segments;
    if (s[0].path && s[0].path.toLowerCase() == "arrivals") {
      this.useArrivals = true;
    }

    this.stationCode = this.route.snapshot.paramMap.get('station').toUpperCase();
    if (this.isNumber(this.route.snapshot.paramMap.get('displays'))) {
      this.displays = Number(this.route.snapshot.paramMap.get('displays'));
    }
    if (queryParams['platform'] && this.isNumber(queryParams['platform'])) {
      this.platform = queryParams['platform'];
    }
    else { this.platform = null }
    document.title = this.stationCode + (this.useArrivals ? " - Arrivals" : " - Departures") + " - Departure Board";
    this.http.get("/api/StationLookup/GetStationNameFromCode?code=" + this.stationCode).subscribe(name => document.title = name + (this.useArrivals ? " - Arrivals" : " - Departures") + " - Departure Board");
    ToggleConfig.LoadingBar.next(true);
    this.GetDepartures();
    this.refresher = setInterval(() => this.GetDepartures(), 16000);
  }

  GetDepartures() {
    if (this.stationCode == null || this.stationCode == "") {
      return;
    }
    const formData = new FormData();
    formData.append("stationCode", this.stationCode);
    formData.append("amount", this.displays.toString());
    var url = "/api/LiveDepartures/" + (this.useArrivals ? "GetLatestArrivals" : "GetLatestDepatures");

	  if (this.platform) {
		  url = url + "?platform=" + this.platform;
    }
    this.googleAnalyticsEventsService.emitEvent("GetDepartures", this.stationCode, (this.useArrivals ? "GetLatestArrivals" : "GetLatestDepatures"));
    this.http.post<object[]>(url, formData).subscribe(response => {
      ToggleConfig.LoadingBar.next(false)
      this.ProcessDepartures(response);
    }, () => ToggleConfig.LoadingBar.next(false));
  }

  ProcessDepartures(data: object[]) {
    this.Boards.clear();
    this.noBoardsDisplay = data.length === 0;

    for (var i = 0; i < data.length; i += 1) {
      const factory = this.resolver.resolveComponentFactory(Board);
      const componentRef = this.Boards.createComponent(factory);
      componentRef.instance.DepartureTime = <Date>Object(data)[i]["aimedDeparture"];
      componentRef.instance.Platform = <number>Object(data)[i]["platform"];
      componentRef.instance.Destination = <string>Object(data)[i]["destination"];
      componentRef.instance.Operator = <string>Object(data)[i]["operatorName"];
      var tempfirststatus = ServiceStatus[this.getEnumKeyByEnumValue(ServiceStatus, Object(data)[i]["status"])]
      if (tempfirststatus == ServiceStatus.LATE) {
        var fexpected = new Date(Date.parse(Object(data)[i]["expectedDeparture"]));
        componentRef.instance.Status = "EXP " + this.datePipe.transform(fexpected, 'HH:mm');
      }
      else {
        componentRef.instance.Status = ServiceStatus[tempfirststatus];
      }

      componentRef.instance.ProcessStops(Object(data)[i]["stops"]);
    }
  }

  ngOnDestroy() {
    clearTimeout(this.refresher);
  }

  getEnumKeyByEnumValue(myEnum, enumValue) {
    let keys = Object.keys(myEnum).filter(x => myEnum[x] == enumValue);
    return keys.length > 0 ? keys[0] : null;
  }

  isNumber(value: string | number): boolean {
    return ((value != null) && !isNaN(Number(value.toString())));
  }
}
