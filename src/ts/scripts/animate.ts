/* eslint-env browser */

/**
 * Mini animation library for simple animations of properties
 *
 * @author Christian Sany <christian.sany@bluewin.ch>
 *
 * TODO: Enable animating colors
 * TODO: Enable animating transforms
 * TODO: Enable animating shadows and all other crazy props
 */

import easings from './easings';

const stripPropUnit = value => parseFloat(value);

const getPropUnit = (value) => {
    if (value.indexOf('px') >= 0) {
        return 'px';
    } else if (value.indexOf('%') >= 0) {
        return '%';
    } else if (value.indexOf('em') >= 0) {
        return 'em';
    } else if (value.indexOf('rem') >= 0) {
        return 'rem';
    }

    // No unit found
    return '';
};

/**
 * Animation function
 *
 * @desc Small Function to animate multiple properties of an element
 *
 * @param {Element} el - The Element you want to animate
 * @param {Object} props - The properties you want to animate to
 * @param {Integer} duration - (optional, default = 400) Time for the animation in ms
 * @param {Array} params - Further optional params
 *                         [, easing|callback [, callback|forceCallback [, forceCallback]]]
 * @return {Function} cancelAnimation - Cancels animation if called
 */
export const animate = (el, props, duration = 400, ...params) => {
    let canceled = false;
    let easing = 'linear';
    let callback;
    let forceCallback;

    // Depending on params length, different variables are assigned
    if (params.length === 1 && typeof params[0] === 'string') {
        easing = params[0];
    } else if (params.length === 1 && params[0] instanceof Function) {
        callback = params[0];
    } else if (params.length > 1 && typeof params[0] === 'string') {
        easing = params[0];
        callback = params[1];
        forceCallback = params[2]; // still falsy if not set
    } else if (params.length > 1 && params[0] instanceof Function) {
        callback = params[0];
        forceCallback = params[1]; // still falsy if not set
    }

    // TODO: Check if all params are assigned accordingly and throw an error if not

    // Check if desired easing exists
    if (!easings[easing] || easings[easing] instanceof Function === false) {
        throw new Error(`The easing ${easing} does not exist, please use one of the following: ${Object.keys(easings).join(', ')}`);
    }

    const styles = window.getComputedStyle(el);
    const queue = Object.entries(props).reduce((r, [property, value]) => {
        r.push({
            property,
            propUnit: getPropUnit(value),
            propStart: stripPropUnit(styles.getPropertyValue(property)),
            propFinish: stripPropUnit(value),
            get difference() {
                return this.propFinish - this.propStart;
            },
        });
        return r;
    }, []);

    let startTime;
    let progress;

    const animation = (time) => {
        // Check if the animation got canceled
        if (canceled) {
            if (forceCallback && callback && callback instanceof Function) {
                callback();
            }

            // Exit the loop
            return;
        }

        // Set the basetime on first call of this function
        if (!startTime) {
            startTime = time;
        }

        // Calculate progress (time passed since start)
        progress = time - startTime;

        if (progress > duration) {
            // In case of slight timing issues the animation can sometimes be short by 1 frame
            // To correct that we're setting the properties all to the final value manually
            queue.forEach((prop) => {
                el.style.setProperty(prop.property, prop.propFinish + prop.propUnit);
            });

            if (callback && callback instanceof Function) {
                callback();
            }
            return;
        }

        // Queue for next interation
        requestAnimationFrame(animation);

        const progressMultiplyer = easings[easing]((1 / duration) * progress);

        queue.forEach((prop) => {
            el.style.setProperty(prop.property,
                ((prop.difference * progressMultiplyer) + prop.propStart) + prop.propUnit);
        });
    };

    // Kick off the animation
    requestAnimationFrame(animation);

    return function cancelAnimation() {
        canceled = true;
    };
};

/**
 * Execute an animation as a Promise
 *
 * INFO: This animation can't be canceled
 *
 * @param {Element} el - The Element you want to animate
 * @param {Object} props - The properties you want to animate to
 * @param {Integer} duration - (optional, default = 400) Time for the animation in ms
 * @param {String} easing - (optional, default = 'linear') The desired easing
 * @return {Promise} resolves when animation finished, rejects if an error is thrown inside animate
 */
export const animateAsPromise = (el, props, duration = 400, easing = 'linear') =>
    new Promise((resolve, reject) => {
        try {
            animate(el, props, duration, easing, resolve);
        } catch (e) {
            reject(e);
        }
    });

/**
 * Add the animate & animateAsPromise to Element.prototype
 */
export const polyfill = (animatePropName = 'customAnimate', animateAsPromisePropName = 'customAnimateAsPromise') => {
    if (!Element.prototype[animatePropName]) {
        Element.prototype[animatePropName] = function customAnimate(...params) {
            //@ts-ignore
            return animate(this, ...params);
        };
    } else {
        throw new Error(`Element.prototype.${animatePropName} is already taken, ${animatePropName} can't be added onto the Element.prototype`);
    }
    if (!Element.prototype[animateAsPromisePropName]) {
        Element.prototype[animateAsPromisePropName] = function customAnimateAsPromise(...params) {
            //@ts-ignore
            return animateAsPromise(this, ...params);
        };
    } else {
        throw new Error(`Element.prototype.${animateAsPromisePropName} is already taken, ${animateAsPromisePropName} can't be added onto the Element.prototype`);
    }
};
