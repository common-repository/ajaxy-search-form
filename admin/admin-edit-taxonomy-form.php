<?php

if (!defined('ABSPATH')) exit;

/**
 * Advanced form for inclusion in the administration panels.
 *
 * @package WordPress
 * @subpackage Administration
 */

$type = isset($_GET['type']) ? $_GET['type'] : exit();
$taxonomy = false;

$taxonomy = get_taxonomy($_GET['name']);

/** @var \Ajaxy\LiveSearch\SF $AjaxyLiveSearch */
global $AjaxyLiveSearch;
$message = false;
if (!empty($taxonomy)) {
    $is_post = $_POST['sf_post'] ?? false;
    if (!empty($is_post)) {
        if (isset($_REQUEST['_wpnonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_REQUEST['_wpnonce'])), 'sf_edit')) {
            if (!empty($_POST['sf_' . $taxonomy->name])) {
                $AjaxyLiveSearch->set_templates($taxonomy->name, sanitize_text_field($_POST['sf_' . $taxonomy->name]));
            }

            $values = array(
                'title' => sanitize_text_field($_POST['sf_title_' . $taxonomy->name] ?? ''),
                'show' => sanitize_text_field($_POST['sf_show_' . $taxonomy->name] ?? ''),
                'search_content' => sanitize_text_field($_POST['sf_search_content_' . $taxonomy->name] ?? ''),
                'limit' => sanitize_text_field($_POST['sf_limit_' . $taxonomy->name] ?? ''),
                'order' => sanitize_text_field($_POST['sf_order_' . $taxonomy->name], ''),
                'excludes' => array_map('sanitize_text_field', $_POST['sf_exclude_' . $taxonomy->name] ?? [])
            );
            if (!empty($_POST['sf_order_results_' . $taxonomy->name])) {
                $values['order_results'] = sanitize_text_field(trim($_POST['sf_order_results_' . $taxonomy->name]));
            }
            if (!empty($_POST['sf_ushow_' . $taxonomy->name])) {
                $values['ushow'] = sanitize_text_field(trim($_POST['sf_ushow_' . $taxonomy->name]));
            }
            $AjaxyLiveSearch->set_setting($taxonomy->name, $values);

            $message = esc_html__("Settings saved", AJAXY_SF_PLUGIN_TEXT_DOMAIN);
        } else {
            $message = esc_html__("Settings have been already saved", AJAXY_SF_PLUGIN_TEXT_DOMAIN);
        }
    }


    $setting = (array)$AjaxyLiveSearch->get_setting($taxonomy->name);

    $allowed_tags = array('term_id', 'name', 'slug', 'taxonomy', 'description', 'count', 'category_link');

    $title  = sprintf(esc_html__('Edit %s template & settings', AJAXY_SF_PLUGIN_TEXT_DOMAIN), $taxonomy->label);
    $notice = '';
?>

    <div class="wrap">
        <h2><?php echo esc_html($title); ?></h2>
        <?php if ($notice) : ?>
            <div id="notice" class="error">
                <p><?php echo esc_html($notice) ?></p>
            </div>
        <?php endif; ?>
        <?php if ($message) : ?>
            <div id="message" class="updated">
                <p><?php echo esc_html($message); ?></p>
            </div>
        <?php endif; ?>
        <form name="post" action="" method="post" id="post">
            <?php wp_nonce_field('sf_edit'); ?>
            <input type="hidden" name="sf_post" value="<?php echo esc_attr($taxonomy->name); ?>" />
            <div id="poststuff" class="metabox-holder has-right-sidebar">
                <div id="side-info-column" class="inner-sidebar">
                    <div id="side-sortables" class="meta-box-sortables ui-sortable">
                        <div id="submitdiv" class="postbox ">
                            <div class="handlediv" title="<?php esc_html_e('Click to toggle', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?>"><br></div>
                            <h3 class="hndle"><span><?php esc_html_e('Save Settings', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></span></h3>
                            <div class="inside">
                                <div class="submitbox" id="submitpost">
                                    <div id="minor-publishing">
                                        <div id="misc-publishing-actions">
                                            <div class="misc-pub-section"><label><?php esc_html_e('Status:', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                                                <p><select name="sf_show_<?php echo esc_attr($taxonomy->name); ?>">
                                                        <option value="1" <?php selected($setting['show'], 1); ?>><?php esc_html_e('Show on search', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                        <option value="0" <?php selected($setting['show'], 0); ?>><?php esc_html_e('hide on search', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                    </select></p>
                                            </div>
                                            <div class="misc-pub-section"><label><?php esc_html_e('Search mode:', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                                                <p><select name="sf_search_content_<?php echo esc_attr($taxonomy->name); ?>">
                                                        <option value="0" <?php selected($setting['search_content'], 0); ?>><?php esc_html_e('Only title', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                        <option value="1" <?php selected($setting['search_content'], 1); ?>><?php esc_html_e('Title and content (Slow)', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                    </select></p>
                                            </div>
                                            <?php if ($type != 'category') : ?>
                                                <div class="misc-pub-section"><label><?php esc_html_e('Order results by:', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                                                    <p><select name="sf_order_results_<?php echo esc_attr($taxonomy->name); ?>">
                                                            <option value="" <?php selected($setting['order_results'], ''); ?>><?php esc_html_e('None (Default)', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                            <option value="post_title asc" <?php selected($setting['order_results'], 'post_title asc'); ?>><?php esc_html_e('Title - Ascending', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                            <option value="post_title desc" <?php selected($setting['order_results'], 'post_title desc'); ?>><?php esc_html_e('Title - Descending', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                            <option value="post_date asc" <?php selected($setting['order_results'], 'post_date asc'); ?>><?php esc_html_e('Date - Ascending', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                            <option value="post_date desc" <?php selected($setting['order_results'], 'post_date desc'); ?>><?php esc_html_e('Date - Descending', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                        </select></p>
                                                </div>
                                            <?php else : ?>
                                                <div class="misc-pub-section"><label><?php esc_html_e('Show "Posts under Category":', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                                                    <p><select name="sf_ushow_<?php echo esc_attr($taxonomy->name); ?>">
                                                            <option value="1" <?php selected($setting['ushow'], '1'); ?>><?php esc_html_e('Show', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                            <option value="0" <?php selected($setting['ushow'], '0'); ?>><?php esc_html_e('hide', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></option>
                                                        </select></p>
                                                </div>
                                            <?php endif; ?>
                                            <div class="misc-pub-section " id="visibility"><label><?php esc_html_e('Order:', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                                                <p><input type="text" style="width:50px" value="<?php echo $setting['order']; ?>" name="sf_order_<?php echo esc_attr($taxonomy->name); ?>" /></p>
                                            </div>
                                            <div class="misc-pub-section " id="limit_results"><label><?php esc_html_e('Limit results to:', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                                                <p><input type="text" style="width:50px" value="<?php echo $setting['limit']; ?>" name="sf_limit_<?php echo esc_attr($taxonomy->name); ?>" /></p>
                                            </div>
                                        </div>
                                        <div class="clear"></div>
                                    </div>
                                    <div id="major-publishing-actions">
                                        <div id="publishing-action">
                                            <input type="submit" name="save" id="save" class="button-primary" value="<?php esc_html_e('Save', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?>" tabindex="5" accesskey="p">
                                        </div>
                                        <div class="clear"></div>
                                    </div>
                                </div>

                            </div>
                        </div>
                        <?php
                        $excludes = (isset($setting['excludes']) && sizeof($setting['excludes']) > 0 ? $setting['excludes'] : array());

                        ?>
                        <div id="submitdiv" class="postbox ">
                            <div class="handlediv" title="<?php esc_html_e('Click to toggle', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?>"><br></div>
                            <h3 class="hndle"><span><?php echo sprintf(esc_html__('Excluded "%s"', AJAXY_SF_PLUGIN_TEXT_DOMAIN), $taxonomy->label); ?></span></h3>
                            <div class="inside">
                                <div class="submitbox">
                                    <div class="misc-pub-section">
                                        <?php
                                        $args = array(
                                            'type'                     => 'post',
                                            'child_of'                 => 0,
                                            'parent'                   => '',
                                            'orderby'                  => 'name',
                                            'order'                    => 'ASC',
                                            'hide_empty'               => 0,
                                            'hierarchical'             => 1,
                                            'exclude'                  => '',
                                            'include'                  => '',
                                            'number'                   => '',
                                            'taxonomy'                 => $taxonomy->name,
                                            'pad_counts'               => false
                                        );
                                        $categories = get_categories($args);
                                        if (sizeof($categories) > 0) {
                                        ?>
                                            <h4><?php echo $taxonomy->label; ?></h4>
                                            <div style="max-height:200px;overflow:auto">
                                                <ul>
                                                    <?php
                                                    foreach ($categories as $category) {
                                                    ?>
                                                        <li><input autocomplete="off" type="checkbox" <?php checked(in_array($category->term_id, (array)$excludes), true); ?> name="sf_exclude_<?php echo esc_attr($taxonomy->name); ?>[]" value="<?php echo $category->term_id; ?>" /> <?php echo esc_html($category->name); ?></li>
                                                    <?php
                                                    }
                                                    ?>
                                                </ul>
                                            </div>
                                        <?php
                                        }
                                        ?>
                                        <hr />
                                        <p class="small"><?php echo sprintf(esc_html__('Prevent selected "%s" from appearing in the search results', AJAXY_SF_PLUGIN_TEXT_DOMAIN), $taxonomy->label); ?></p>

                                    </div>

                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                <div id="post-body">
                    <div id="post-body-content">
                        <div id="titlediv">
                            <div id="titlewrap">
                                <label class="hide-if-no-js" style="visibility:hidden" id="title-prompt-text" for="title"><?php esc_html_e('Enter title here', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></label>
                                <input type="text" name="sf_title_<?php echo esc_attr($taxonomy->name); ?>" size="30" tabindex="1" value="<?php echo esc_attr(empty($setting['title']) ? $taxonomy->label : $setting['title']); ?>" id="title" autocomplete="off" />
                            </div>
                        </div>
                        <div id="postdivrich" class="postarea">
                            <h2><?php echo sprintf(esc_html__('"%s" Template', AJAXY_SF_PLUGIN_TEXT_DOMAIN), $taxonomy->label); ?></h2>
                            <p><?php esc_html_e('Changes are live, use the tags below to customize the data replaced by each template.', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                            <?php wp_editor($AjaxyLiveSearch->get_templates($taxonomy->name, $type), 'sf_' . $taxonomy->name); ?>
                            <table id="post-status-info" cellspacing="0">
                                <tbody>
                                    <tr>
                                        <td><b><?php esc_html_e('Tags:', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></b>
                                            {<?php echo implode("}, {", $allowed_tags); ?>}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <br class="clear" />
            </div>
        </form>
    </div>
<?php } else {
?>
    <h3><?php esc_html_e('Oops it looks like this page is no longer available or have been deleted :(', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
<?php
}
?>