import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

@Injectable({
  providedIn: "root",
})
export class BusDepartureService {
  constructor(private http: HttpClient) {}

  GetDepartures(atco: string, count: number = 4): Observable<object[]> {
    var url = "/api/BusLiveDepartures/GetBusLiveDepartures";

    var params = new HttpParams().append("code", atco);
    params = params.append("count", count.toString());

    return this.http.get<object[]>(environment.apiBaseUrl + url, {
      params: params,
    });
  }
}
