import { ZONES } from "./zone";

export interface PrayerTime {
    hijri: string;
    date: string;
    day: string;
    imsak: string;
    fajr: string;
    syuruk: string;
    dhuha: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
}

export interface JakimResponse {
    prayerTime: PrayerTime[];
    status: string;
    serverTime: string;
    periodType: string;
    lang: string;
    zone: (typeof ZONES)[number];
}

export interface PrayerData {
    jakim: JakimResponse[];
    last_fetched: number;
}