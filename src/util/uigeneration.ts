import { BlueGem } from "../@typings/ExtensionTypes";

export function genRefreshButton(name: 'Start' | 'Stop'): HTMLDivElement {
    const element = document.createElement('div');
    element.classList.add('betterfloat-refresh' + name.toString());
    element.textContent = name.toString();
    return element;
}

export function genGemContainer(runtimePublicURL: string, patternElement: BlueGem.PatternElement | null) {
    const gemContainer = document.createElement('div');
    const gemImage = document.createElement('img');
    gemImage.setAttribute('src', runtimePublicURL + '/gem-shop.svg');
    gemImage.setAttribute(
        'style',
        'height: 25px; margin-right: 5px; margin-top: 1px; filter: brightness(0) saturate(100%) invert(57%) sepia(46%) saturate(3174%) hue-rotate(160deg) brightness(102%) contrast(105%);'
    );
    gemContainer.appendChild(gemImage);
    if (patternElement) {
        const gemValue = document.createElement('span');
        gemValue.style.color = 'deepskyblue';
        gemValue.textContent = `${patternElement.playside.toFixed(0)}% / ${patternElement.backside.toFixed(0)}%`;
        gemContainer.appendChild(gemValue);
    }
    return gemContainer;
}

export function generateSpStickerContainer(priceSum: number, spPercentage: number, isItemPage = false) {
    const outerContainer = document.createElement('div');
    const spContainer = document.createElement('span');
    spContainer.classList.add('betterfloat-sticker-price');
    let backgroundImageColor = '';
    if (spPercentage < 0.005 || spPercentage > 2) {
        backgroundImageColor = 'black';
    } else if (spPercentage > 1) {
        backgroundImageColor = 'rgba(245,0,0,1)';
    } else if (spPercentage > 0.5) {
        backgroundImageColor = 'rgba(245,164,0,1)';
    } else if (spPercentage > 0.25) {
        backgroundImageColor = 'rgba(244,245,0,1)';
    } else {
        backgroundImageColor = 'rgba(83,245,0,1)';
    }
    spContainer.style.backgroundImage = `linear-gradient(135deg, ${backgroundImageColor}, rgb(0, 115, 213))`;
    spContainer.style.color = 'white';
    spContainer.style.fontWeight = '600';
    spContainer.style.borderRadius = '7px';
    // if SP is above 200% or below 0.5% display SP in $, otherwise in %
    if (spPercentage > 2 || spPercentage < 0.005) {
        spContainer.textContent = `SP: $${priceSum.toFixed(0)}`;
    } else {
        spContainer.textContent = `SP: ${(spPercentage > 0 ? spPercentage * 100 : 0).toFixed(1)}%`;
    }
    if (isItemPage) {
        outerContainer.style.margin = '25px 0 10px 10px';
        spContainer.style.padding = '5px 10px';
    } else {
        spContainer.style.padding = '2px 5px';
        outerContainer.style.position = 'absolute';
        outerContainer.style.top = '135px';
        outerContainer.style.left = '10px';
        outerContainer.style.margin = '0 0 10px 10px';
    }
    outerContainer.appendChild(spContainer);
    return outerContainer;
}

export function createLanguagePopup(runtimePublicURL: string, page: 'Skinport' | 'Skinbaron', changeHandler: () => void) {
    const popupOuter = document.createElement('div');
    popupOuter.className = 'betterfloat-popup-outer';
    popupOuter.style.backdropFilter = 'blur(2px)';
    popupOuter.style.fontSize = '16px';
    const popup = document.createElement('div');
    popup.className = 'betterfloat-popup-language';
    const popupHeaderDiv = document.createElement('div');
    popupHeaderDiv.style.display = 'flex';
    popupHeaderDiv.style.alignItems = 'center';
    popupHeaderDiv.style.justifyContent = 'space-between';
    popupHeaderDiv.style.margin = '0 10px';
    const warningIcon = document.createElement('img');
    warningIcon.src = runtimePublicURL + '/triangle-exclamation-solid.svg';
    warningIcon.style.width = '32px';
    warningIcon.style.height = '32px';
    warningIcon.style.filter = 'brightness(0) saturate(100%) invert(42%) sepia(99%) saturate(1934%) hue-rotate(339deg) brightness(101%) contrast(105%)';
    const popupHeaderText = document.createElement('h2');
    popupHeaderText.style.fontWeight = '700';
    popupHeaderText.textContent = 'Warning: Language not supported';
    const closeButton = document.createElement('a');
    closeButton.className = 'close';
    closeButton.style.marginBottom = '10px';
    closeButton.textContent = 'x';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => {
        popupOuter.remove();
    };
    popupHeaderDiv.appendChild(warningIcon);
    popupHeaderDiv.appendChild(popupHeaderText);
    popupHeaderDiv.appendChild(closeButton);
    const popupText = document.createElement('p');
    popupText.style.marginTop = '30px';
    popupText.textContent =
        "BetterFloat currently only supports the English language on Skinport. If you prefer to pass on most of BetterFloat's features on Skinport, please disable the 'Buff Price Calculation'-feature in the extension settings.";
    const buttonDiv = document.createElement('div');
    buttonDiv.style.display = 'flex';
    buttonDiv.style.justifyContent = 'center';
    const changeLanguageButton = document.createElement('button');
    changeLanguageButton.type = 'button';
    changeLanguageButton.className = 'betterfloat-language-button';
    changeLanguageButton.textContent = 'Change language';
    changeLanguageButton.onclick = changeHandler;
    buttonDiv.appendChild(changeLanguageButton);
    popup.appendChild(popupHeaderDiv);
    popup.appendChild(popupText);
    popup.appendChild(buttonDiv);
    popupOuter.appendChild(popup);
    document.body.appendChild(popupOuter);
}