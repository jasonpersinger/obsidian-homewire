import { describe, expect, test } from "vitest";
import fixture from "../fixtures/open-meteo.json";
import {
  airQualityUrl, forecastUrl, geocodeUrl, parseAqi, parseForecast, parseGeocode, weatherLabel,
} from "../../src/core/weather";

describe("urls", () => {
  test("forecast imperial", () => {
    const u = forecastUrl(37.27, -79.94, "imperial");
    expect(u).toContain("temperature_unit=fahrenheit");
    expect(u).toContain("timezone=auto");
    expect(u).toContain("forecast_days=7");
    expect(u).toContain("latitude=37.27");
  });
  test("forecast metric", () => expect(forecastUrl(1, 2, "metric")).not.toContain("fahrenheit"));
  test("air quality", () => expect(airQualityUrl(1, 2)).toMatch(/^https:\/\/air-quality-api\.open-meteo\.com\/v1\/air-quality\?.*current=us_aqi/));
  test("geocode searches the first part of the place", () => {
    expect(geocodeUrl("Roanoke, Virginia, US")).toMatch(/^https:\/\/geocoding-api\.open-meteo\.com\/v1\/search\?name=Roanoke&/);
  });
});

describe("parseForecast", () => {
  const w = parseForecast(fixture)!;
  test("7 days and today's 24 hours", () => {
    expect(w.daily).toHaveLength(7);
    expect(w.hourly).toHaveLength(24);
    expect(w.hourly[0]).toEqual({ hour: 0, temp: fixture.hourly.temperature_2m[0] });
  });
  test("now", () => expect(w.now).toEqual({ temp: 54.7, feelsLike: 49.8, code: 1, isDay: true }));
  test("daily row and sun times", () => {
    expect(w.daily[0]).toEqual({
      date: "2026-10-30",
      min: fixture.daily.temperature_2m_min[0],
      max: fixture.daily.temperature_2m_max[0],
      precipPct: fixture.daily.precipitation_probability_max[0],
      code: fixture.daily.weather_code[0],
    });
    expect(w.sunrise).toBe(fixture.daily.sunrise[0]);
    expect(w.sunset).toBe(fixture.daily.sunset[0]);
  });
  test("malformed gives null", () => {
    expect(parseForecast({})).toBeNull();
    expect(parseForecast(null)).toBeNull();
    expect(parseForecast({ current: {}, hourly: {}, daily: {} })).toBeNull();
  });
});

test("parseAqi", () => {
  expect(parseAqi({ current: { us_aqi: 54 } })).toBe(54);
  expect(parseAqi({})).toBeNull();
});

describe("parseGeocode", () => {
  const results = [
    { name: "Roanoke", admin1: "Texas", country_code: "US", latitude: 33, longitude: -97 },
    { name: "Roanoke", admin1: "Virginia", country_code: "US", latitude: 37.27, longitude: -79.94 },
  ];
  test("matches the qualifiers", () => {
    expect(parseGeocode({ results }, "Roanoke, Virginia, US")).toEqual({ lat: 37.27, lon: -79.94, label: "Roanoke, Virginia" });
  });
  test("plain name takes the first result", () => {
    expect(parseGeocode({ results: [{ name: "Paris", admin1: "Île-de-France", latitude: 48.85, longitude: 2.35 }] }, "Paris"))
      .toEqual({ lat: 48.85, lon: 2.35, label: "Paris, Île-de-France" });
  });
  test("no results", () => expect(parseGeocode({}, "Nowhere")).toBeNull());
});

test("weatherLabel", () => {
  expect(weatherLabel(0, true).text).toBe("Clear");
  for (const c of [61, 63, 65]) expect(weatherLabel(c, true).text).toContain("Rain");
  expect(weatherLabel(12345, true).text).toBe("Unknown");
  expect(weatherLabel(0, false).icon).not.toBe(weatherLabel(0, true).icon);
});
