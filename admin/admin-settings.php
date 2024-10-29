<?php

if (!defined('ABSPATH')) exit;

/** @var \Ajaxy\LiveSearch\SF $AjaxyLiveSearch */
global $AjaxyLiveSearch;
$message = false;

$values = (array)$AjaxyLiveSearch->get_styles();
if (isset($_POST['sf_rsubmit']) && isset($_POST['_wpnonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_wpnonce'])))) {
    $AjaxyLiveSearch->clear_styles();
    $AjaxyLiveSearch->remove_template('more');
} elseif (isset($_POST['sf_submit']) && isset($_POST['_wpnonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_wpnonce'])))) {
    $styles = $_POST['sf']['style'];
   
    $templates = $_POST['sf']['template'];

    $values = array_replace($values, [
        'search_label' => $styles['label'] ?? 'Search',
        'input_id' => $styles['input_id'],
        'width' => (int)$styles['width'],
        'credits' => (int)$styles['credits'] ?? 1,
        'aspect_ratio' => (int)$styles['aspect_ratio'] ?? 0,
        'hook_search_form' => (int)$styles['hook_form'] ?? 0,
        'rtl_theme' => (int)$styles['rtl'] ?? 0,
        'delay' => (int)$styles['delay'],
        'border-width' => (int)$styles['b_width'] ?? 0,
        'border-type' => $styles['b_type'] ?? 'none',
        'border-color' => $styles['b_color'] ?? '000000',
        'search_url' => $styles['url'] ?? '',
        'results_width' => (int)$styles['results_width'] ?? 0,
        'results_width_unit' => $styles['results_width_unit'] ?? 'px',
        'excerpt' => (int)$styles['excerpt'] ?? 10,
        'css' => $styles['css'] ?? '',
        'thumb_width' => (int)$styles['thumb_width'] ?? 50,
        'thumb_height' => (int)$styles['thumb_height'] ?? 50,
    ]);

    $AjaxyLiveSearch->set_styles($values);
    
    $AjaxyLiveSearch->set_templates('more', $templates['more_results']);
    $message = esc_html__("Settings saved", AJAXY_SF_PLUGIN_TEXT_DOMAIN);

  
}
?>
<?php if ($message) : ?>
    <div id="message" class="updated">
        <p><?php echo esc_html($message); ?></p>
    </div>
<?php endif; ?>
<div class="ajaxy-wrap">
    <h3><?php esc_html_e('Search Form Box', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
    <div>
        <table class="form-table">
            <tbody>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Allow Ajaxy to hook search form', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input type="checkbox" name="sf[style][hook_form]" <?php checked($values['hook_search_form'] > 0, true); ?> value="1" />
                        <span class="description"><?php esc_html_e('unCheck this in case you want to use your theme search form and use the ID box.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></span>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Use Right to Left styles when needed', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input type="checkbox" name="sf[style][rtl]" <?php checked($values['rtl_theme'] > 0, true); ?> value="1" />
                        <span class="description"><?php esc_html_e('Check this in case you want to use rtl themes to support right to left languages like arabic.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></span>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Search label', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input type="text" value="<?php echo esc_attr($values['search_label']); ?>" name="sf[style][label]" class="regular-text">
                        <p class="description"><?php esc_html_e('This label appears inside the search form and will be hidden when the user clicks inside.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Input ID or class name', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input type="text" value="<?php echo $values['input_id']; ?>" name="sf[style][input_id]" class="regular-text">
                        <p class="description"><?php esc_html_e('keep this blank to use ajaxy search form, or else put the id of the search or the class name in the form (#ID for id (# before the id) or else (.className) ( "." before the className).', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Width', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input style="width:90px" type="text" value="<?php echo esc_attr($values['width']); ?>" name="sf[style][width]" class="regular-text">
                        <p class="description"><?php esc_html_e('The width of the search form (width is per pixel) - the value should be integer.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Delay time', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input style="width:90px" type="text" value="<?php echo esc_attr($values['delay']); ?>" name="sf[style][delay]" class="regular-text">
                        <p class="description"><?php esc_html_e('The delay time before showing the results (this will allow the user to input more text before searching) -  <b>(in millisecond, i.e 5000 = 5sec)</b>.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Border width', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input style="width:90px" type="text" value="<?php echo esc_attr($values['border-width']); ?>" name="sf[style][b_width]" class="regular-text">
                        <p class="description"><?php esc_html_e('The width of the search form border.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Border type', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <select name="sf[style][b_type]">
                            <option value="solid" <?php selected($values['border-type'], 'solid'); ?>><?php esc_html_e('solid', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                            <option value="dotted" <?php selected($values['border-type'], 'dotted'); ?>><?php esc_html_e('dotted', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                            <option value="dashed" <?php selected($values['border-type'], 'dashed'); ?>><?php esc_html_e('dashed', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                        </select>
                        <p class="description"><?php esc_html_e('The type of the search form border.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Border color', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input style="width:52px" type="text" value="<?php echo esc_attr($values['border-color']); ?>" name="sf[style][b_color]" class="regular-text">
                        <p class="description"><?php esc_html_e('The color of the search form border (color value is hexa-decimal).', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>

            </tbody>
        </table>
    </div>
    <h3><?php esc_html_e('Search Results box', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
    <div>
        <table class="form-table">
            <tbody>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Width', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input style="width:90px" type="number" value="<?php echo esc_attr($values['results_width']); ?>" name="sf[style][results_width]" class="regular-text">
                        <select name="sf[style][results_width_unit]">
                            <option value="px" <?php selected($values['results_width_unit'], 'px'); ?>><?php esc_html_e('Pixels', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                            <option value="%" <?php selected($values['results_width_unit'], '%'); ?>><?php esc_html_e('Percent', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                        </select>
                        <p class="description"><?php esc_html_e('The width of the results box (width is per pixel/percent) - the value should be integer.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Total words', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input style="width:90px" type="text" value="<?php echo esc_attr($values['excerpt']); ?>" name="sf[style][excerpt]" class="regular-text">
                        <p class="description"><?php esc_html_e('The post content total number of words to be shown under each result.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Thumb size', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <label><?php esc_html_e('height', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                        <input style="width:90px" type="text" value="<?php echo esc_attr($values['thumb_height']); ?>" name="sf[style][thumb_height]" class="regular-text">
                        <label><?php esc_html_e('X width', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                        <input style="width:90px" type="text" value="<?php echo esc_attr($values['thumb_width']); ?>" name="sf[style][thumb_width]" class="regular-text">
                        <input type="checkbox" name="sf[style][aspect_ratio]" <?php checked($values['aspect_ratio'] > 0, true); ?> /><label><?php esc_html_e('Maintain aspect ratio', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                        <br class="clear" />
                        <p class="description"><?php esc_html_e('The thumbnail size used in the post template it will modify {post_image_html} only, Maintaining aspect ratio is relatively slow so be aware, modifing the thumb size will need some css changes.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <h3><?php esc_html_e('More results box', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
    <div>
        <table class="form-table">
            <tbody>
                <tr valign="top">
                    <th scope="row"><label><?php esc_html_e('Search Url', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label></th>
                    <td>
                        <input type="text" value="<?php echo esc_attr($values['search_url']); ?>" name="sf[style][url]" class="regular-text">
                        <p class="description"><?php esc_html_e('This search URL for the "See more results"', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <td colspan="2">
                        <textarea style="width:99%; height:150px" name="sf[template][more_results]" class="regular-text"><?php echo esc_textarea($AjaxyLiveSearch->get_templates('more', 'more')); ?></textarea>
                        <br class="clear" />
                        <p class="description"><?php esc_html_e('More results text (allowed parameters ( <b>{search_value}</b> <b>{search_value_escaped}</b> <b>{search_url_escaped}</b>).', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <h3><?php printf(esc_html__('Custom styles (%s)', AJAXY_SF_PLUGIN_TEXT_DOMAIN), '<a href="http://www.w3schools.com/css/css_syntax.asp" target="_blank" rel="nofollow">CSS</a>'); ?></h3>
    <div>
        <table class="form-table">
            <tbody>
                <tr valign="top">
                    <td colspan="2">
                        <textarea style="width:99%; height:150px" name="sf[style][css]" class="regular-text"><?php echo esc_textarea($values['css']); ?></textarea>
                        <br class="clear" />
                        <p class="description"><?php esc_html_e('Custom styles to be added in the plugin css. add ( .screen-reader-text { display:none; } ) if you want to hide the search form title.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <h3><?php esc_html_e('Credits', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
    <div>
        <table class="form-table">
            <tbody>
                <tr valign="top">
                    <td colspan="2">
                        <input type="checkbox" name="sf[style][credits]" <?php checked($values['credits'], 1); ?> value="1" />
                        <span class="description"><?php esc_html_e('Author "Powered by" link and credits.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <br class="clear" />
    <input class="button-primary" name="sf_submit" type="submit" value="<?php esc_html_e('Save Changes', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?>" />
    <input class="button-primary" onclick="return confirm('<?php esc_html_e('Are you sure you want to reset all your settings?', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?>');" name="sf_rsubmit" type="submit" value="<?php esc_attr_e('Reset Setting to defaults', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?>" />
    <br class="clear" />
</div>