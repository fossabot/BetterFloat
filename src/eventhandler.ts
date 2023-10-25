import { EventData, CSFloat } from './@typings/FloatTypes';
import { Skinbaron } from './@typings/SkinbaronTypes';
import { Skinbid } from './@typings/SkinbidTypes';
import { Skinport } from './@typings/SkinportTypes';
import {
    cacheCSFHistoryGraph,
    cacheCSFHistorySales,
    cacheCSFItems,
    cacheCSFPopupItem,
    cacheSkbItems,
    cacheSkinportCurrencyRates,
    cacheSkinbidCurrencyRate,
    loadMapping,
    cacheSkinbidUserCurrency,
    cacheSpItems,
    cacheSpPopupItem,
    cacheSkinbaronItems,
} from './mappinghandler';
import { handleListed, handleSold } from './skinport/websockethandler';

type StallData = {
    listings: CSFloat.ListingData[];
    user: CSFloat.SellerData;
};

type SkinportWebsocketData = {
    eventType: string;
    data: Skinport.Item[];
};

export function activateHandler() {
    // important: https://stackoverflow.com/questions/9515704/access-variables-and-functions-defined-in-page-context-using-a-content-script/9517879#9517879
    document.addEventListener('BetterFloat_INTERCEPTED_REQUEST', function (e) {
        const eventData = (<CustomEvent>e).detail;
        //switch depending on current site
        if (location.href.includes('csfloat.com')) {
            processCSFloatEvent(eventData);
        } else if (location.href.includes('skinport.com')) {
            processSkinportEvent(eventData);
        } else if (location.href.includes('skinbid.com')) {
            processSkinbidEvent(eventData);
        } else if (location.href.includes('skinbaron.de')) {
            processSkinbaronEvent(eventData);
        }
    });

    document.addEventListener('BetterFloat_WEBSOCKET_EVENT', function (e) {
        const eventData = (<CustomEvent>e).detail as SkinportWebsocketData;
        if (eventData.eventType == 'listed') {
            // console.debug('[BetterFloat] Received data from websocket "listed":', eventData);
            handleListed(eventData.data);
        } else if (eventData.eventType == 'sold') {
            // console.debug('[BetterFloat] Received data from websocket "sold":', eventData);
            handleSold(eventData.data);
        }
    });

    //listener for messages from background
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (request.message == 'refreshPrices') {
            loadMapping().then((value) => {
                if (value) {
                    console.log('[BetterFloat] Prices refreshed manually via popup.');
                    sendResponse({ message: 'Prices fetched successfully.' });
                } else {
                    console.log('[BetterFloat] Error refreshing prices manually.');
                    sendResponse({ message: 'Error while fetching prices.' });
                }
            });
        }
    });

    // refresh prices if they are older than 8 hours
    chrome.storage.local.get('lastUpdate', (result) => {
        let lastUpdate = result.lastUpdate;
        if (lastUpdate == undefined) {
            lastUpdate = 0;
        }
        // if lastUpdate is older than 8 hours, refresh prices
        if (lastUpdate < Date.now() - 1000 * 60 * 60 * 8) {
            console.debug('[BetterFloat] Prices are older than 8 hours, last update:', new Date(lastUpdate), '. Refreshing prices...');
            // send message to background to fetch and store new prices
            chrome.runtime.sendMessage({ message: 'fetchPrices' }, (response) => {
                if (!response) return;
                console.debug('[BetterFloat] Prices refresh result: ' + response.message);
                if (response.success) {
                    chrome.storage.local.set({ lastUpdate: Date.now() });
                }
            });
        }
    });
}

function processSkinbaronEvent(eventData: EventData<unknown>) {
    console.debug('[BetterFloat] Received data from url: ' + eventData.url + ', data:', eventData.data);
    if (eventData.url.includes('appId=') && !eventData.url.includes('appId=730')) {
        console.debug('[BetterFloat] Skinbaron: Ignoring non-csgo request');
        return;
    }
    if (eventData.url.includes('api/v2/Browsing/FilterOffers')) {
        // Skinbaron.FilterOffers
        cacheSkinbaronItems((eventData.data as Skinbaron.FilterOffers).aggregatedMetaOffers);
    } else if (eventData.url.includes('api/v2/PromoOffers')) {
        // Skinbaron.PromoOffers
        cacheSkinbaronItems((eventData.data as Skinbaron.PromoOffers).bestDeals.aggregatedMetaOffers);
    }
}

function processSkinbidEvent(eventData: EventData<unknown>) {
    console.debug('[BetterFloat] Received data from url: ' + eventData.url + ', data:', eventData.data);
    if (eventData.url.includes('api/search/auctions')) {
        // Skinbid.MarketData
        cacheSkbItems((eventData.data as Skinbid.MarketData).items);
    } else if (eventData.url.includes('api/auction/itemInventoryStatus')) {
        // content: { cachedResult: boolean, inSellerInventory: boolean }
    } else if (eventData.url.includes('api/auction/shop')) {
        // shop data
        if (eventData.url.includes('/data')) {
            // Skinbid.ShopData
        } else {
            cacheSkbItems((eventData.data as Skinbid.MarketData).items);
        }
    } else if (eventData.url.includes('api/auction/')) {
        // Skinbid.Listing
        cacheSkbItems([eventData.data as Skinbid.Listing]);
    } else if (eventData.url.includes('api/public/exchangeRates')) {
        // Skinbid.ExchangeRates
        const rates = eventData.data as Skinbid.ExchangeRates;
        cacheSkinbidCurrencyRate(rates.find((rate) => rate.currencyCode == 'USD')?.rate ?? 1);
    } else if (eventData.url.includes('api/user/whoami')) {
        // Skinbid.UserData
    } else if (eventData.url.includes('api/user/preferences')) {
        // Skinbid.UserPreferences
        cacheSkinbidUserCurrency((eventData.data as Skinbid.UserPreferences).currency);
    }
}

function processSkinportEvent(eventData: EventData<unknown>) {
    console.debug('[BetterFloat] Received data from url: ' + eventData.url + ', data:', eventData.data);
    if (eventData.url.includes('api/browse/730')) {
        // Skinport.MarketData
        cacheSpItems((eventData.data as Skinport.MarketData).items);
    } else if (eventData.url.includes('api/item')) {
        // Skinport.ItemData
        cacheSpPopupItem(eventData.data as Skinport.ItemData);
    } else if (eventData.url.includes('api/home')) {
        // Skinport.HomeData
    } else if (eventData.url.includes('api/data/')) {
        // Data from first page load
        const data = eventData.data as Skinport.UserData;
        cacheSkinportCurrencyRates(data.rates, data.currency);
    }
}

// process intercepted data
function processCSFloatEvent(eventData: EventData<unknown>) {
    console.debug('[BetterFloat] Received data from url: ' + eventData.url + ', data:', eventData.data);
    if (eventData.url.includes('v1/listings?')) {
        cacheCSFItems(eventData.data as CSFloat.ListingData[]);
    } else if (eventData.url.includes('v1/listings/recommended')) {
        // recommended for you tab
        cacheCSFItems(eventData.data as CSFloat.ListingData[]);
    } else if (eventData.url.includes('v1/listings/unique-items')) {
        // unique items tab
        cacheCSFItems(eventData.data as CSFloat.ListingData[]);
    } else if (eventData.url.includes('v1/me/watchlist')) {
        // own watchlist
        cacheCSFItems(eventData.data as CSFloat.ListingData[]);
    } else if (eventData.url.includes('v1/me/listings')) {
        // own stall
        cacheCSFItems(eventData.data as CSFloat.ListingData[]);
    } else if (eventData.url.includes('v1/users/')) {
        // url schema: v1/users/[:userid]
        // sellers stall, gives StallData
        cacheCSFItems((eventData.data as StallData).listings);
    } else if (eventData.url.includes('v1/history/')) {
        // item history, gets called on item popup
        if (eventData.url.includes('/graph')) {
            cacheCSFHistoryGraph(eventData.data as CSFloat.HistoryGraphData[]);
        } else if (eventData.url.includes('/sales')) {
            // item table - last sales
            cacheCSFHistorySales(eventData.data as CSFloat.HistorySalesData[]);
        }
    } else if (eventData.url.includes('v1/me')) {
        // user data, repeats often
    } else if (eventData.url.includes('v1/listings/') && eventData.url.split('/').length == 7) {
        // item popup
        cacheCSFPopupItem(eventData.data as CSFloat.ListingData);
    }
}
