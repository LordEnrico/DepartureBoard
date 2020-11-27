﻿using DepartureBoardCore;
using Newtonsoft.Json.Linq;
using RestSharp;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using Newtonsoft.Json;

namespace TrainDataAPI.Services
{
	public class StationLookup
	{
		public StationLookup()
		{
			LoadStationList();
		}
		public List<Station> Stations
		{
			get {
				//Load the stations if the dictionary is not populated
				if (_stations == null || _stations.Count == 0 || _lastUpdated < DateTime.Now.AddHours(-1))
				{
					LoadStationList();
				}
				return _stations; 
			}
		}
		private List<Station> _stations = new List<Station>();
		private readonly object _stationsLock = new object();
		private DateTime _lastUpdated = DateTime.MinValue;

		public void LoadStationList()
		{
			if (string.IsNullOrEmpty(ConfigService.NationalRail_Username) || string.IsNullOrEmpty(ConfigService.NationalRail_Password))
			{
				Console.WriteLine("***National Rail Credentials Need Populating in the config.xml file***");
				return;
			}

			lock (_stationsLock)
			{
                //Does a seconds check whilst in the locked state
                if (_stations != null && _stations.Count > 0 && _lastUpdated >= DateTime.Now.AddHours(-1))
                {
                    return;
                }

				_stations = new List<Station>();
				try
				{
					LoadUKStations();
					LoadDEStations();
				}
				catch (Exception ex) { Console.WriteLine(ex.Message); }
			}
		}

		private void LoadUKStations()
		{
			string token = GetSecretToken();
			var client = new RestClient("https://opendata.nationalrail.co.uk/api/staticfeeds/4.0/stations");
			var request = new RestRequest(Method.GET);
			request.Timeout = 15000;
			request.AddHeader("X-Auth-Token", token);
			var response = client.Execute(request);
			if (response.StatusCode != HttpStatusCode.OK)
				return;
			XElement xmlResponse = XElement.Parse(response.Content);
			foreach (XElement element in xmlResponse.Elements())
			{
				string code = element.Element("{http://nationalrail.co.uk/xml/station}CrsCode")?.Value;
				string name = element.Element("{http://nationalrail.co.uk/xml/station}Name")?.Value;
				if (!string.IsNullOrEmpty(code) && !string.IsNullOrEmpty(name) && IsValidEntry(name, code))
					_stations.Add(new Station(code, name, "GB"));
			}

			_lastUpdated = DateTime.Now;
		}

		private void LoadDEStations()
		{
			if(string.IsNullOrEmpty(ConfigService.DeutscheBahnToken))
				return;

			var client = new RestClient("https://api.deutschebahn.com/stada/v2/stations");
			var request = new RestRequest(Method.GET);
			request.AddHeader("Authorization", $"Bearer {ConfigService.DeutscheBahnToken}");
			IRestResponse response = client.Execute(request);
			DBStationsResponse dbStationsResponse = JsonConvert.DeserializeObject<DBStationsResponse>(response.Content);
			foreach (DBStationsResponse.DBStation dbStation in dbStationsResponse.result)
			{
				if(!dbStation.evaNumbers.Any())
					continue;
				
				_stations.Add(new Station(dbStation.evaNumbers.First().number, dbStation.name, "DE"));
			}
		}

		private bool IsValidEntry(string name, string code)
		{
			switch (name)
			{
				case "London St Pancras (Intl)":
					return false;
			}

			switch (code)
			{
				case "SPX":
					return false;
			}

			return true;
		}

		private string GetSecretToken()
		{
			var client = new RestClient("https://opendata.nationalrail.co.uk/authenticate");
			var request = new RestRequest(Method.POST);
			var body = new
			{
				username = ConfigService.NationalRail_Username,
				password = ConfigService.NationalRail_Password
			};
			request.AddHeader("Content-Type", "application/json");
			request.AddJsonBody(body);
			var response = client.Execute(request);
			if (response.StatusCode != HttpStatusCode.OK)
				return null;

			JObject jsonResponse = JObject.Parse(response.Content);
			return jsonResponse["token"]?.ToString();
		}

		public class Station
		{
			public string Code { get; set; }
			public string Name { get; set; }
			public string Country { get; set; }

			public Station(string code, string name, string country)
			{
				Code = code;
				Name = name;
				Country = country;
			}
		}

		private class DBStationsResponse
		{
			public List<DBStation> result { get; set; }
			public class DBStation
			{
				public string name { get; set; }
				public List<EvaNumber> evaNumbers { get; set; }

				public class EvaNumber
				{
					public string number { get; set; }
				}
			}
		}
	}
}
