<?php

/**
 * @package Ajaxy
 */
/*
	Plugin Name: Ajaxy Instant Search
	Plugin URI: https://www.ajaxy.org/ajaxy-live-search-plugin
	Description: Transfer wordpress form into an advanced ajax search form the same as facebook live search, This version supports themes and can work with almost all themes without any modifications
	Version: 6.0.2
	Author: Naji Amer (Ajaxy)
	Author URI: https://www.ajaxy.org
	License: GPLv2 or later
    License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
    Requires PHP: 7.0
*/

namespace Ajaxy\LiveSearch;


define("AJAXY_SF_PLUGIN_TEXT_DOMAIN", "ajaxy-sf");
define('AJAXY_SF_VERSION', '6.0.2');
define('AJAXY_SF_PLUGIN_URL', plugin_dir_url(__FILE__));
define('AJAXY_THEMES_DIR', dirname(__FILE__) . "/themes/");
define('AJAXY_SF_NO_IMAGE', plugin_dir_url(__FILE__) . "themes/default/images/no-image.gif");

class SF
{
    public static $woocommerce_taxonomies = array('product_cat', 'product_tag', 'product_shipping_class');
    public static $woocommerce_post_types = array('product', 'shop_order', 'shop_coupon');

    private $wpml = false;

    private $default_templates = [
        'post' => '<a href="%s">%s<span class="sf-content"><span class="sf-text">%s</span><span class="sf-small">%s</span></span></a>'
    ];

    function __construct()
    {
        spl_autoload_register(function ($class_name) {
            if (\stripos($class_name, __NAMESPACE__ . '\\') === 0) {
                require_once dirname(__FILE__) . '/' . strtolower(str_ireplace([__NAMESPACE__ . '\\', '\\'], ['', '/'], $class_name)) . '.php';
            }
        });

        $this->actions();
        $this->filters();
        $this->shortcodes();
    }
    function actions()
    {

        add_action('wp_enqueue_scripts', array(&$this, "enqueue_scripts"));
        add_action('admin_enqueue_scripts', array(&$this, "admin_enqueue_scripts"));

        add_action("admin_menu", array(&$this, "menu_pages"));
        add_action('wp_footer', array(&$this, 'footer'));
        add_action('admin_footer', array(&$this, 'footer'));

        add_action('wp_ajax_ajaxy_sf', array(&$this, 'get_search_results'));
        add_action('wp_ajax_nopriv_ajaxy_sf', array(&$this, 'get_search_results'));

        add_action('wp_ajax_ajaxy_sf_shortcode', array(&$this, 'get_shortcode'));

        add_action('admin_notices', array(&$this, 'admin_notice'));
        add_action('plugins_loaded', array(&$this, 'load_textdomain'));

        add_action('wpml_loaded', function () {
            $this->wpml = true;
        });

        $editor = new Admin\Classes\Editor\Editor();
    }


    function filters()
    {
        $styles = $this->get_styles([
            'hook_search_form' => 1,
        ]);
        if ($styles['hook_search_form'] > 0) {
            add_filter('get_search_form', array(&$this, 'form_shortcode'), 1);
        }
        add_filter('ajaxy-overview', array(&$this, 'admin_page'), 10);
    }
    function shortcodes()
    {
        add_shortcode('ajaxy-live-search', array(&$this, 'form_shortcode'));
    }
    function overview()
    {
        echo apply_filters('ajaxy-overview', 'main');
    }

    function load_textdomain()
    {
        load_plugin_textdomain(AJAXY_SF_PLUGIN_TEXT_DOMAIN, false, plugin_basename(__DIR__) . '/langs');
    }

    function menu_page_exists($menu_slug)
    {
        global $menu;
        foreach ($menu as $i => $item) {
            if ($menu_slug == $item[2]) {
                return true;
            }
        }
        return false;
    }

    function menu_pages()
    {
        if (!$this->menu_page_exists('ajaxy-page')) {
            add_menu_page(_n('Ajaxy', 'Ajaxy', 1, AJAXY_SF_PLUGIN_TEXT_DOMAIN), _n('Ajaxy', 'Ajaxy', 1, AJAXY_SF_PLUGIN_TEXT_DOMAIN), 'Ajaxy', 'ajaxy-page', array(&$this, 'overview'), AJAXY_SF_PLUGIN_URL . '/images/ico.svg');
        }
        add_submenu_page('ajaxy-page', __('Instant Search', AJAXY_SF_PLUGIN_TEXT_DOMAIN), __('Instant Search', AJAXY_SF_PLUGIN_TEXT_DOMAIN), 'manage_options', 'ajaxy_sf_admin', array(&$this, 'admin_page'));
    }
    function admin_page()
    {
        $message = false;

        if (isset($_GET['edit'])) {
            if ($_GET['type'] == 'taxonomy') {
                include_once('admin/admin-edit-taxonomy-form.php');
                return true;
            } elseif ($_GET['type'] == 'role') {
                include_once('admin/admin-edit-role-form.php');
                return true;
            } else {
                include_once('admin/admin-edit-post-form.php');
                return true;
            }
        }
        $tab = (!empty($_GET['tab']) ? trim($_GET['tab']) : false);

        //form data
        switch ($tab) {
            case 'woocommerce':
            case 'taxonomy':
            case 'author':
            case 'post_type':
            case 'templates':
                $public = ($tab == 'author' ? false : true);
                if (isset($_POST['action'])) {
                    $action = trim($_POST['action']);
                    $ids = (isset($_POST['template_id']) ? (array)$_POST['template_id'] : false);
                    if ($action == 'hide' && $ids) {
                        global $AjaxyLiveSearch;
                        $k = 0;
                        foreach ($ids as $id) {
                            $setting = (array)$AjaxyLiveSearch->get_setting($id, $public);
                            $setting['show'] = 0;
                            $AjaxyLiveSearch->set_setting($id, $setting);
                            $k++;
                        }
                        $message = sprintf(esc_html__('%s templates hidden', \AJAXY_SF_PLUGIN_TEXT_DOMAIN), $k);
                    } elseif ($action == 'show' && $ids) {
                        global $AjaxyLiveSearch;
                        $k = 0;
                        foreach ($ids as $id) {
                            $setting = (array)$AjaxyLiveSearch->get_setting($id, $public);
                            $setting['show'] = 1;
                            $AjaxyLiveSearch->set_setting($id, $setting);
                            $k++;
                        }
                        $message = sprintf(esc_html__('%s templates shown', \AJAXY_SF_PLUGIN_TEXT_DOMAIN), $k);
                    }
                } elseif (isset($_GET['show']) && isset($_GET['name'])) {
                    global $AjaxyLiveSearch;
                    if ($tab == 'author') {
                        $setting = (array)$AjaxyLiveSearch->get_setting('role_' . $_GET['name'], $public);
                        $setting['show'] = (int)$_GET['show'];
                        $AjaxyLiveSearch->set_setting('role_' . $_GET['name'], $setting);
                    } else {
                        $setting = (array)$AjaxyLiveSearch->get_setting($_GET['name'], $public);
                        $setting['show'] = (int)$_GET['show'];
                        $AjaxyLiveSearch->set_setting($_GET['name'], $setting);
                    }
                    $message = esc_html__('Template modified', AJAXY_SF_PLUGIN_TEXT_DOMAIN);
                }
                break;
            case 'themes':
                if (isset($_GET['theme']) && isset($_GET['apply'])) {
                    $this->set_styles(['theme' => $_GET['theme']]);
                    $message = $_GET['theme'] . ' theme applied';
                }
                break;
            default:
        }

?>
        <div class="wrap">
            <div id="icon-edit" class="icon32 icon32-posts-post"><br></div>
            <h2><?php esc_html_e('Ajaxy Instant Search', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h2>
            <nav class="nav-tab-wrapper">
                <a href="<?php echo esc_url(menu_page_url('ajaxy_sf_admin', false)); ?>" class="nav-tab <?php echo (!$tab ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('General settings', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?><span class="count"></span></a>
                <a href="<?php echo esc_url(menu_page_url('ajaxy_sf_admin', false) . '&tab=post_type'); ?>" class="nav-tab <?php echo esc_attr($tab == 'post_type' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Post type', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?><span class="count"></span></a>
                <a href="<?php echo esc_url(menu_page_url('ajaxy_sf_admin', false) . '&tab=taxonomy'); ?>" class="nav-tab <?php echo esc_attr($tab == 'taxonomy' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Taxonomy', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?><span class="count"></span></a>
                <a href="<?php echo esc_url(menu_page_url('ajaxy_sf_admin', false) . '&tab=author'); ?>" class="nav-tab <?php echo esc_attr($tab == 'author' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Author', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?><span class="count"></span></a>
                <a href="<?php echo esc_url(menu_page_url('ajaxy_sf_admin', false) . '&tab=woocommerce'); ?>" class="nav-tab ajaxy-sf-new <?php echo ($tab == 'woocommerce' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('WooCommerce', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?><span class="count-new">New *</span></a>
                <a href="<?php echo esc_url(menu_page_url('ajaxy_sf_admin', false) . '&tab=themes'); ?>" class="nav-tab <?php echo esc_attr($tab == 'themes' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Themes', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?><span class="count"></span></a>
                <a href="<?php echo esc_url(menu_page_url('ajaxy_sf_admin', false) . '&tab=shortcode'); ?>" class="nav-tab <?php echo esc_attr($tab == 'shortcode' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Shortcodes', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?><span class="count"></span></a>
                <a href="<?php echo esc_url(menu_page_url('ajaxy_sf_admin', false) . '&tab=preview'); ?>" class="nav-tab <?php echo esc_attr($tab == 'preview' ? 'nav-tab-active' : ''); ?>"><?php esc_html_e('Preview', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?><span class="count"></span></a>
            </nav>
            <form id="ajaxy-form" action="" method="post">
                <?php wp_nonce_field(); ?>
                <?php if ($tab == 'post_type') : ?>
                    <?php

                    $list_table = new Admin\Classes\List_Table($this->get_search_objects(true, 'post_type'));
                    ?>
                    <div>
                        <?php if ($message) : ?>
                            <div id="message" class="updated">
                                <p><?php echo esc_html($message); ?></p>
                            </div>
                        <?php endif; ?>
                        <?php $list_table->display(); ?>
                    </div>
                <?php elseif ($tab == 'taxonomy') : ?>
                    <?php
                    $list_table = new Admin\Classes\List_Table($this->get_search_objects(true, 'taxonomy'));
                    ?>
                    <div>
                        <?php if ($message) : ?>
                            <div id="message" class="updated">
                                <p><?php echo esc_html($message); ?></p>
                            </div>
                        <?php endif; ?>
                        <?php $list_table->display(); ?>
                    </div>
                <?php elseif ($tab == 'author') : ?>
                    <?php
                    $list_table = new Admin\Classes\List_Table($this->get_search_objects(true, 'author'), false, 'role_');
                    ?>
                    <div>
                        <?php if ($message) : ?>
                            <div id="message" class="updated">
                                <p><?php echo esc_html($message); ?></p>
                            </div>
                        <?php endif; ?>
                        <?php $list_table->display(); ?>
                    </div>
                <?php elseif ($tab == 'themes') : ?>
                    <?php
                    $list_table = new Admin\Classes\Themes();
                    ?>
                    <div>
                        <?php if ($message) : ?>
                            <div id="message" class="updated">
                                <p><?php echo esc_html($message); ?></p>
                            </div>
                        <?php endif; ?>
                        <?php $list_table->display(); ?>
                    </div>
                <?php elseif ($tab == 'preview') : ?>
                    <br class="clear" />
                    <hr style="margin-bottom:20px" />
                    <div class="wrap">
                        <?php ajaxy_search_form(); ?>
                    </div>
                    <hr style="margin:20px 0 10px 0" />
                    <p class="description"><?php esc_html_e('Use the form above to preview theme changes and settings, please note that the changes could vary from one theme to another, please contact the author of this plugin for more help', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></p>
                    <hr style="margin:10px 0" />
                <?php elseif ($tab == 'woocommerce') :
                    $list_table = new Admin\Classes\List_Table($this->get_search_objects(true, 'taxonomy', array(), self::$woocommerce_taxonomies));
                ?>
                    <h3><?php esc_html_e('WooCommerce Taxonomies', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
                    <div class="ajaxy-form-nowrap">
                        <?php if ($message) : ?>
                            <div id="message" class="updated">
                                <p><?php echo esc_html($message); ?></p>
                            </div>
                        <?php endif; ?>
                        <?php $list_table->display(); ?>
                    </div>
                    <h3><?php esc_html_e('WooCommerce Post Types', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
                    <?php
                    $list_table = new Admin\Classes\List_Table($this->get_search_objects(true, 'post_type', self::$woocommerce_post_types, array()));
                    ?>
                    <div class="ajaxy-form-nowrap">
                        <?php if ($message) : ?>
                            <div id="message" class="updated">
                                <p><?php echo esc_html($message); ?></p>
                            </div>
                        <?php endif; ?>
                        <?php $list_table->display(); ?>
                    </div>
                <?php elseif ($tab == 'author') :
                    $list_table = new Admin\Classes\List_Table($this->get_search_objects(false, 'author'), true, 'role_');
                ?>
                    <h3><?php esc_html_e('WooCommerce Taxonomies', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
                    <div class="ajaxy-form-nowrap">
                        <?php if ($message) : ?>
                            <div id="message" class="updated">
                                <p><?php echo esc_html($message); ?></p>
                            </div>
                        <?php endif; ?>
                        <?php $list_table->display(); ?>
                    </div>
                    <h3><?php esc_html_e('WooCommerce Post Types', AJAXY_SF_PLUGIN_TEXT_DOMAIN); ?></h3>
                    <?php
                    $list_table = new Admin\Classes\List_Table($this->get_search_objects(true, 'post_type', self::$woocommerce_post_types, array()));
                    ?>
                    <div class="ajaxy-form-nowrap">
                        <?php if ($message) : ?>
                            <div id="message" class="updated">
                                <p><?php echo esc_html($message); ?></p>
                            </div>
                        <?php endif; ?>
                        <?php $list_table->display(); ?>
                    </div>
                <?php elseif ($tab == 'shortcode') :
                    include_once('admin/admin-shortcodes.php');
                else :
                    include_once('admin/admin-settings.php');
                endif; ?>
            </form>

        </div>
<?php
    }

    function get_image_from_content($content, $width_max, $height_max)
    {
        //return false;
        $theImageSrc = false;
        preg_match_all('/<img[^>]+>/i', $content, $matches);
        $imageCount = count($matches);

        $styles = $this->get_styles([
            'aspect_ratio' => 0,
            'thumb_width' => 50,
            'thumb_height' => 50
        ]);
        if ($imageCount >= 1) {
            if (isset($matches[0][0])) {
                preg_match_all('/src=("[^"]*")/i', $matches[0][0], $src);
                if (isset($src[1][0])) {
                    $theImageSrc = str_replace('"', '', $src[1][0]);
                }
            }
        }
        if ($styles['aspect_ratio'] > 0) {
            try {
                list($width, $height, $type, $attr) = @getimagesize($theImageSrc);
                if ($width > 0 && $height > 0) {
                    if ($width < $width_max && $height < $height_max) {
                        return array('src' => $theImageSrc, 'width' => $width, 'height' => $height);
                    } elseif ($width > $width_max && $height > $height_max) {
                        $percent_width = $width_max * 100 / $width;
                        $percent_height = $height_max * 100 / $height;
                        $percent = ($percent_height < $percent_width ? $percent_height : $percent_width);
                        return array('src' => $theImageSrc, 'width' => intval($width * $percent / 100), 'height' => intval($height * $percent / 100));
                    } elseif ($width < $width_max && $height > $height_max) {
                        $percent = $height * 100 / $height_max;
                        return array('src' => $theImageSrc, 'width' => intval($width * $percent / 100), 'height' => intval($height * $percent / 100));
                    } else {
                        $percent = $width * 100 / $width_max;
                        return array('src' => $theImageSrc, 'width' => intval($width * $percent / 100), 'height' => intval($height * $percent / 100));
                    }
                }
            } catch (\Exception $e) {
                return array('src' => $theImageSrc, 'width' => $styles['thumb_width'], 'height' => $styles['thumb_height']);
            }
        } else {
            return array('src' => $theImageSrc, 'width' => $styles['thumb_width'], 'height' => $styles['thumb_height']);
        }
        return false;
    }
    function get_post_types()
    {
        $post_types = get_post_types(array('_builtin' => false), 'objects');
        $post_types['post'] = get_post_type_object('post');
        $post_types['page'] = get_post_type_object('page');
        return $post_types;
    }

    function get_taxonomies()
    {
        $args = array(
            'public'   => true,
            '_builtin' => false
        );
        $output = 'objects'; // or objects
        $operator = 'or'; // 'and' or 'or'
        $taxonomies = get_taxonomies($args, $output, $operator);
        if ($taxonomies) {
            return $taxonomies;
        }
        return null;
    }
    function get_search_objects($all = false, $objects = false, $specific_post_types = array(), $specific_taxonomies = array(), $specific_roles = array())
    {
        $search = array();
        $scat = (array)$this->get_setting('category');
        $arg_category_show = isset($_POST['show_category']) ? $_POST['show_category'] : 1;

        $search_taxonomies = false;

        if ($scat['show'] == 1 && $arg_category_show == 1) {
            $search_taxonomies = true;
        }
        $arg_post_category_show = isset($_POST['show_post_category']) ? $_POST['show_post_category'] : 1;

        $show_post_category = false;

        if ($scat['ushow'] == 1 && $arg_post_category_show == 1) {
            $show_post_category = true;
        }

        if (!$objects || $objects == 'post_type') {
            // get all post types that are ready for search
            $post_types = $this->get_post_types();
            foreach ($post_types as $post_type) {
                if (sizeof($specific_post_types) == 0) {
                    $setting = $this->get_setting($post_type->name);
                    if ($setting->show == 1 || $all) {
                        $search[] = array(
                            'order' => $setting->order,
                            'name' => $post_type->name,
                            'label' => empty($setting->title) ? $post_type->label : $setting->title,
                            'type' =>     'post_type'
                        );
                    }
                } elseif (in_array($post_type->name, $specific_post_types)) {
                    $setting = $this->get_setting($post_type->name);
                    $search[] = array(
                        'order' => $setting->order,
                        'name' => $post_type->name,
                        'label' => empty($setting->title) ? $post_type->label : $setting->title,
                        'type' =>     'post_type'
                    );
                }
            }
        }
        if ((!$objects || $objects == 'taxonomy') && $search_taxonomies) {
            // override post_types from input
            $taxonomies = $this->get_taxonomies();
            foreach ($taxonomies as $taxonomy) {
                if (sizeof($specific_taxonomies) == 0) {
                    $setting = $this->get_setting($taxonomy->name);
                    if ($setting->show == 1 || $all) {
                        $search[] = array(
                            'order' => $setting->order,
                            'name' => $taxonomy->name,
                            'label' => empty($setting->title) ? $taxonomy->label : $setting->title,
                            'type' =>     'taxonomy',
                            'show_posts' => $show_post_category
                        );
                    }
                } elseif (in_array($taxonomy->name, $specific_taxonomies)) {
                    $setting = $this->get_setting($taxonomy->name);
                    $search[] = array(
                        'order' => $setting->order,
                        'name' => $taxonomy->name,
                        'label' => empty($setting->title) ? $taxonomy->label : $setting->title,
                        'type' =>     'taxonomy',
                        'show_posts' => $show_post_category
                    );
                }
            }
        } elseif ((!$objects || $objects == 'taxonomy')) {
            // override post_types from input

            $taxonomies = $this->get_taxonomies();
            foreach ($taxonomies as $taxonomy) {
                if (sizeof($specific_taxonomies) == 0) {
                    $setting = $this->get_setting($taxonomy->name);
                    if ($setting->show == 1 || $all) {
                        $search[] = array(
                            'order' => $setting->order,
                            'name' => $taxonomy->name,
                            'label' => empty($setting->title) ? $taxonomy->label : $setting->title,
                            'type' =>     'taxonomy',
                            'show_posts' => $show_post_category
                        );
                    }
                } elseif (in_array($taxonomy->name, $specific_taxonomies)) {
                    $setting = $this->get_setting($taxonomy->name);
                    $search[] = array(
                        'order' => $setting->order,
                        'name' => $taxonomy->name,
                        'label' => empty($setting->title) ? $taxonomy->label : $setting->title,
                        'type' =>     'taxonomy',
                        'show_posts' => $show_post_category
                    );
                }
            }
        }
        if (!$objects || $objects == 'author') {

            global $wp_roles;
            $roles = $wp_roles->get_names();

            foreach ($roles as $role => $label) {
                if (sizeof($specific_roles) == 0) {
                    $setting = $this->get_setting('role_' . $role, false);
                    if ($setting->show == 1 || $all) {
                        $search[] = array(
                            'order' => $setting->order,
                            'name' => $role,
                            'label' => empty($setting->title) ? $label : $setting->title,
                            'type' =>     'role'
                        );
                    }
                } elseif (in_array($role, $specific_roles)) {
                    $setting = $this->get_setting('role_' . $role, false);
                    $search[] = array(
                        'order' => $setting->order,
                        'name' => $role,
                        'label' => empty($setting->title) ? $label : $setting->title,
                        'type' =>     'role'
                    );
                }
            }
        }
        uasort($search, array(&$this, 'sort_search_objects'));

        return $search;
    }
    function sort_search_objects($a, $b)
    {
        if ($a['order'] == $b['order']) {
            return 0;
        }
        return ($a['order'] < $b['order']) ? -1 : 1;
    }
    function set_templates($template, $html)
    {
        if (get_option('ajaxy_sf_template_' . $template) !== false) {
            update_option('ajaxy_sf_template_' . $template, stripslashes($html));
        } else {
            add_option('ajaxy_sf_template_' . $template, stripslashes($html));
        }
    }
    function set_setting($name, $value)
    {
        if (get_option('ajaxy_sf_setting_' . $name) !== false) {
            update_option('ajaxy_sf_setting_' . $name, wp_json_encode($value));
        } else {
            add_option('ajaxy_sf_setting_' . $name, wp_json_encode($value));
        }
    }
    function remove_setting($name)
    {
        delete_option('ajaxy_sf_setting_' . $name);
    }
    function get_setting($name, $public = true)
    {
        $show = 0;
        if (\in_array($name, ['category', 'post', 'page', 'product'])) {
            $show = 1;
        }
        $defaults = array(
            'title' => '',
            'show' => $show,
            'ushow' => 0,
            'search_content' => 0,
            'limit' => 5,
            'order' => 0,
            'order_results' => false
        );
        if (!$public) {
            $defaults['show'] = 0;
        }
        if (get_option('ajaxy_sf_setting_' . $name) !== false) {
            $settings = json_decode(get_option('ajaxy_sf_setting_' . $name));
            foreach ($defaults as $key => $value) {
                if (!isset($settings->{$key})) {
                    $settings->{$key} = $value;
                }
            }
            return $settings;
        } else {
            return (object)$defaults;
        }
    }
    function set_styles(array $names)
    {
        $styles = get_option('ajaxy_sf_styles');
        if ($styles !== false) {
            $styles = array_merge($styles, $names);
            update_option('ajaxy_sf_styles', $styles);
        } else {
            add_option('ajaxy_sf_styles', $names);
        }
    }

    function clear_styles()
    {
        delete_option('ajaxy_sf_styles');
    }
    function get_styles($default = [])
    {
        $styles = get_option('ajaxy_sf_styles', []) ?? [];

        $options = [];
        //migrate

        foreach ($default as $key => $value) {
            if (!isset($styles[$key])) {
                $option = get_option('ajaxy_sf_style_' . $key, $value);
                if ($option !== false) {
                    $options[$key] = $option;
                }
                delete_option('ajaxy_sf_style_' . $key);
            }
        }

        if (count($options) > 0) {
            $out = \array_replace($default, (array)$styles, $options);
            update_option('ajaxy_sf_styles', $out);
            return $out;
        }
        return \array_replace($default, (array)$styles);
    }
    function remove_template($template)
    {
        delete_option('ajaxy_sf_template_' . $template);
    }
    function get_templates($template, $type = '')
    {
        $template_post = "";
        switch ($type) {
            case 'more':
                $template_post = get_option('ajaxy_sf_template_more');
                if (!$template_post) {
                    $template_post = '<a href="{search_url_escaped}"><span class="sf-text">See more results for "{search_value}"</span><span class="sf-small">Displaying top {total} results</span></a>';
                }
                break;
            case 'taxonomy':
                $template_post = get_option('ajaxy_sf_template_' . $template);
                if (!$template_post) {
                    $template_post = '<a href="{category_link}">{name}</a>';
                }
                break;
            case 'author':
            case 'role':
                $template_post = get_option('ajaxy_sf_template_' . $template);
                if (!$template_post) {
                    $template_post = '<a href="{author_link}">{user_nicename}</a>';
                }
                break;
            case 'post_type':
                $template_post = get_option('ajaxy_sf_template_' . $template);
                if (!$template_post && in_array($template, self::$woocommerce_post_types)) {
                    $template_post = sprintf($this->default_templates['post'], '{post_link}', '{post_image_html}', '{post_title} - {price}', 'Posted by {post_author} on {post_date_formatted}');
                } elseif (!$template_post) {
                    $template_post = sprintf($this->default_templates['post'], '{post_link}', '{post_image_html}', '{post_title}', 'Posted by {post_author} on {post_date_formatted}');
                }
                break;
            default:
                $template_post = get_option('ajaxy_sf_template_' . $template);
                if (!$template_post) {
                    $template_post = sprintf($this->default_templates['post'], '{post_link}', '{post_image_html}', '{post_title}', 'Posted by {post_author} on {post_date_formatted}');
                }
                break;
        }
        return $template_post;
    }
    function category($name, $taxonomy = 'category', $show_category_posts = false, $limit = 5)
    {
        global $wpdb;

        $categories = array();
        $setting = (object)$this->get_setting($taxonomy);

        $excludes = "";
        $excludes_array = array();
        if (isset($setting->excludes) && sizeof($setting->excludes) > 0 && is_array($setting->excludes)) {
            $excludes = " AND $wpdb->terms.term_id NOT IN (" . implode(',', $setting->excludes) . ")";
            $excludes_array = $setting->excludes;
        }
        $results = null;

        $query = "
			SELECT
				distinct($wpdb->terms.name)
				, $wpdb->terms.term_id
				, $wpdb->term_taxonomy.taxonomy
			FROM
				$wpdb->terms
				, $wpdb->term_taxonomy
			WHERE
				name LIKE %s
				AND $wpdb->term_taxonomy.taxonomy = %s
				AND $wpdb->term_taxonomy.term_id = $wpdb->terms.term_id
			%s
			LIMIT 0, %d";

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $results = $wpdb->get_results($wpdb->prepare($query, '%' . $wpdb->esc_like($name) . '%', $taxonomy, $excludes, $setting->limit));

        if (sizeof($results) > 0 && is_array($results) && !is_wp_error($results)) {
            foreach ($results as $result) {
                /** @disregard */
                $term_id = function_exists('pll_get_term') ? \pll_get_term($result->term_id) : $result->term_id;
                $cat = get_term($term_id, $result->taxonomy);
                if ($cat != null && !is_wp_error($cat)) {
                    $cat_object = new \stdclass();
                    $category_link = get_term_link($cat);
                    $cat_object->category_link = $category_link;

                    $matches = array();
                    $template = $this->get_templates($taxonomy, 'taxonomy');
                    preg_match_all("/\{.*?\}/", $template, $matches);

                    foreach ($matches[0] as $match) {
                        $match = str_replace(array('{', '}'), '', $match);
                        if (isset($cat->{$match})) {
                            $cat_object->{$match} = $cat->{$match};
                        }
                    }
                    if ($show_category_posts) {
                        $limit = isset($setting->limit_posts) ? $setting->limit_posts : 5;
                        $psts = $this->posts_by_term($cat->term_id, $taxonomy, $limit);
                        if (sizeof($psts) > 0) {
                            $categories[$cat->term_id] = array('name' => $cat->name, 'posts' => $this->posts_by_term($cat->term_id, $limit));
                        }
                    } else {
                        $categories[] = $cat_object;
                    }
                }
            }
        }
        return $categories;
    }
    function author($name, $show_author_posts = false, $limit = 5)
    {
        global $wpdb;

        $authors = array();

        $results = null;

        $query = "
			SELECT
				*
			FROM
				$wpdb->users
			WHERE
				ID IN (
					SELECT
						user_id
					FROM
						$wpdb->usermeta
					WHERE
						(meta_key = 'first_name' AND meta_value LIKE %s)
						OR (meta_key = 'last_name' AND meta_value LIKE %s )
						OR (meta_key = 'nickname' AND meta_value LIKE %s )
				)
		";
        $search = '%' . $wpdb->esc_like($name) . '%';
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $results = $wpdb->get_results($wpdb->prepare($query, $search, $search, $search));

        if (sizeof($results) > 0 && is_array($results) && !is_wp_error($results)) {
            foreach ($results as $result) {
                $authors[] = new \WP_User($result->ID);
            }
        }
        return $authors;
    }
    function filter_authors_by_role($authors, $role)
    {
        $users = array();
        $setting = (object)$this->get_setting('role_' . $role, false);

        $excludes_array = array();
        if (isset($setting->excludes) && sizeof($setting->excludes) > 0 && is_array($setting->excludes)) {
            $excludes_array = $setting->excludes;
        }
        $template = $this->get_templates('role_' . $role, 'author');
        $matches = array();
        preg_match_all("/\{.*?\}/", $template, $matches);
        if (sizeof($matches) > 0) {

            foreach ($authors as $author) {
                if (in_array($role, $author->roles) && !in_array($author->ID, $excludes_array)) {
                    $user = new \stdClass();
                    foreach ($matches[0] as $match) {
                        $match = str_replace(array('{', '}'), '', $match);
                        $method = "get_" . $match;
                        if (method_exists($author->data, $method)) {
                            $user->{$match} = call_user_func(array($author->data, $method));
                        } elseif (method_exists($author, $match)) {
                            $user->{$match} = call_user_func(array($author->data, $match));
                        } elseif (property_exists($author->data, $match)) {
                            $user->{$match} = $author->data->{$match};
                        }
                    }
                    if (in_array('{author_link}', $matches[0])) {
                        $user->author_link = get_author_posts_url($author->ID);
                    }
                    $users[] = $user;
                }
            }
        }
        return $users;
    }
    function posts($name, $post_type = 'post', $term_id = false)
    {
        global $wpdb;
        $posts = array();
        $setting = (object)$this->get_setting($post_type);
        $excludes = "";
        if (isset($setting->excludes) && is_array($setting->excludes) && sizeof($setting->excludes) > 0) {
            $excludes = " AND ID NOT IN (" . implode(',', $setting->excludes) . ")";
        }

        $order_results = ($setting->order_results ? " ORDER BY " . $setting->order_results : "");

        $results = array();

        $search = '%' . $wpdb->esc_like($name) . '%';

        if ($setting->search_content == 1) {
            $query = "
                SELECT
                    $wpdb->posts.ID
                FROM
                    $wpdb->posts
                WHERE
                    (post_title LIKE %s or post_content LIKE %s)
                    AND post_status='publish'
                    AND post_type = %s
                    %s
                    %s
                LIMIT 0, %d";
            $results = $wpdb->get_results($wpdb->prepare($query, $search, $search, $post_type, $excludes, $order_results, $setting->limit));
        } else {
            $query = "
                SELECT
                    $wpdb->posts.ID
                FROM
                    $wpdb->posts
                WHERE
                    (post_title LIKE %s)
                    AND post_status='publish'
                    AND post_type = %s
                    %s
                    %s
                LIMIT 0, %d";
            $results = $wpdb->get_results($wpdb->prepare($query, $search, $post_type, $excludes, $order_results, $setting->limit));
        }

        if (sizeof($results) > 0 && is_array($results) && !is_wp_error($results)) {
            $template = $this->get_templates($post_type, 'post_type');
            $matches = array();
            preg_match_all("/\{.*?\}/", $template, $matches);
            if (sizeof($matches) > 0) {
                foreach ($results as $result) {
                    $pst = $this->post_object($result->ID, $term_id, $matches[0]);
                    if ($pst) {
                        $posts[] = $pst;
                    }
                }
            }
        }
        return $posts;
    }
    function posts_by_term($term_id, $taxonomy, $limit = 5)
    {
        $posts = array();
        $args = array(
            'showposts' => $limit,
            'tax_query' => array(
                array(
                    'taxonomy' => $taxonomy,
                    'terms' => $term_id,
                    'field' => 'term_id',
                )
            ),
            'orderby' => 'date',
            'order' => 'DESC'
        );
        $term_query = new \WP_Query($args);
        if ($term_query->have_posts()) :
            $psts = apply_filters('ajaxy_sf_pre_term_posts', $term_query->posts);
            if (sizeof($psts) > 0) {
                foreach ($psts as $p) {
                    $matches = array();
                    $template = $this->get_templates($p->post_type, 'post_type');
                    preg_match_all("/\{.*?\}/", $template, $matches);
                    $posts[] = $this->post_object($p->ID, false, $matches[0]);
                }
            }
            $posts = apply_filters('ajaxy_sf_term_posts', $posts);
        endif;
        return $posts;
    }
    function post_object($id, $term_id = false, $matches = [])
    {
        global $post;
        $date_format = get_option('date_format');

        /** @disregard */
        $id = function_exists('pll_get_post') ? pll_get_post($id) : $id;
        $post = get_post($id);
        if ($term_id) {
            if (!in_category($term_id, $post->ID)) {
                return false;
            }
        }
        $size = null;

        $styles = $this->get_styles(array(
            'thumb_height' => 50,
            'thumb_width' => 50,
            'excerpt' => 10
        ));
        $height = (int)$styles['thumb_height'];
        $width = (int)$styles['thumb_width'];
        if ($height !== '50' || $width !== '50') {
            $size = array('height' => $height, 'width' => $width);
        }
        if ($post != null) {
            $post_object = new \stdclass();
            $post_link = get_permalink($post->ID);
            if (in_array('{post_image}', $matches) || in_array('{post_image_html}', $matches)) {
                $post_object->post_image_html = '';
                $post_thumbnail_id = get_post_thumbnail_id($post->ID);
                if ($post_thumbnail_id > 0) {
                    $thumb = wp_get_attachment_image_src($post_thumbnail_id, $size ? array($size['height'], $size['width']) : 'full');
                    $post_object->post_image =  (trim($thumb[0]) == "" ? AJAXY_SF_NO_IMAGE : $thumb[0]);
                    if (in_array('{post_image_html}', $matches)) {
                        $style = "background-image:url({$post_object->post_image})";
                        if ($size) {
                            $style .= sprintf(';width:%spx;height:%spx;flex:0 0 %spx', $size['width'], $size['height'], $size['width']);
                        }
                        $post_object->post_image_html = '<div class="sf-thumbnail-image" style="' . $style . '"></div>';
                    }
                } else {
                    if ($src = $this->get_image_from_content($post->post_content, $size['height'], $size['width'])) {
                        $post_object->post_image = $src['src'] ? $src['src'] : AJAXY_SF_NO_IMAGE;
                        if (in_array('{post_image_html}', $matches)) {
                            $style = "background-image:url({$post_object->post_image})";
                            if ($size) {
                                $style .= sprintf(';width:%spx;height:%spx;flex:0 0 %spx', $size['width'], $size['height'], $size['width']);
                            }
                            $post_object->post_image_html = '<div class="sf-thumbnail-image" style="' . $style . '"></div>';
                        }
                    } else {
                        $post_object->post_image = AJAXY_SF_NO_IMAGE;
                        if (in_array('{post_image_html}', $matches)) {
                            $post_object->post_image_html = '';
                        }
                    }
                }
            }
            if ($post->post_type == 'product' && class_exists('\WC_Product_Factory')) {
                $product_factory = new \WC_Product_Factory();
                global $product;
                $product = $product_factory->get_product($post);
                if ($product->is_visible()) {
                    foreach ($matches as $match) {
                        $match = str_replace(array('{', '}'), '', $match);
                        if (in_array($match, array('categories', 'tags'))) {
                            $method = "get_" . $match;
                            if (method_exists($product, $method)) {
                                $term_list = call_user_func(array($product, $method), '');
                                if ($term_list) {
                                    $post_object->{$match} = '<span class="sf-list sf-' . $match . '">' . $term_list . '</span>';
                                } else {
                                    $post_object->{$match} = "";
                                }
                            }
                        } elseif ($match == 'add_to_cart_button') {
                            ob_start();
                            do_action('woocommerce_' . $product->product_type . '_add_to_cart');
                            $post_object->{$match} = '<div class="product">' . ob_get_contents() . '</div>';
                            ob_end_clean();
                        } else {
                            $method = "get_" . $match;
                            if (method_exists($product, $method)) {
                                $post_object->{$match} = call_user_func(array($product, $method));
                            } elseif (method_exists($product, $match)) {
                                $post_object->{$match} = call_user_func(array($product, $match));
                            }
                        }
                    }
                }
                /*
				$post->sku = $product->get_sku();
				$post->sale_price = $product->get_sale_price();
				$post->regular_price = $product->get_regular_price();
				$post->price = $product->get_price();
				$post->price_including_tax = $product->get_price_including_tax();
				$post->price_excluding_tax = $product->get_price_excluding_tax();
				$post->price_suffix = $product->get_price_suffix();
				$post->price_html = $product->get_price_html();
				$post->price_html_from_text = $product->get_price_html_from_text();
				$post->average_rating = $product->get_average_rating();
				$post->rating_count = $product->get_rating_count();
				$post->rating_html = $product->get_rating_html();
				$post->dimensions = $product->get_dimensions();
				$post->shipping_class = $product->get_shipping_class();
				$post->add_to_cart_text = $product->add_to_cart_text();
				$post->single_add_to_cart_text = $product->single_add_to_cart_text();
				$post->add_to_cart_url = $product->add_to_cart_url();
				$post->title = $product->get_title();
				*/
            }
            $post_object->ID = $post->ID;
            $post_object->post_title = get_the_title($post->ID);

            if (in_array('{post_excerpt}', $matches)) {
                $post_object->post_excerpt = $post->post_excerpt;
            }
            if (in_array('{post_author}', $matches)) {
                $post_object->post_author = get_the_author_meta('display_name', $post->post_author);
            }
            if (in_array('{post_link}', $matches)) {
                $post_object->post_link = $post_link;
            }
            if (in_array('{post_content}', $matches)) {
                $post_object->post_content = $this->get_text_words(apply_filters('the_content', $post->post_content), (int)$styles['excerpt']);
            }
            if (in_array('{post_date_formatted}', $matches)) {
                $post_object->post_date_formatted = gmdate($date_format,  strtotime($post->post_date));
            }



            foreach ($matches as $match) {
                $match = str_replace(array('{', '}'), '', $match);

                if (strpos($match, 'custom_field_') !== false) {
                    $key =  str_replace('custom_field_', '', $match);
                    $custom_field = get_post_meta($post->ID, $key, true);
                    if (is_array($custom_field)) {
                        $cf_name = 'custom_field_' . $key;
                        $post_object->{$cf_name} = apply_filters('ajaxy_sf_post_custom_field', $custom_field[0], $key, $post);
                    } else {
                        $cf_name = 'custom_field_' . $key;
                        $post_object->{$cf_name} = apply_filters('ajaxy_sf_post_custom_field', $custom_field, $key, $post);
                    }
                }
            }

            $post_object = apply_filters('ajaxy_sf_post', $post_object);
            return $post_object;
        }
        return false;
    }
    function get_text_words($text, $count)
    {
        $tr = explode(' ', \wp_strip_all_tags(strip_shortcodes($text)));
        $s = [];
        for ($i = 0; $i < $count && $i < sizeof($tr); $i++) {
            $s[] = $tr[$i];
        }
        return implode(' ', $s);
    }
    function enqueue_scripts()
    {
        wp_enqueue_script('ajaxy-sf-search', AJAXY_SF_PLUGIN_URL . "js/app.js", array(), AJAXY_SF_VERSION, true);
        $this->enqueue_common_styles();
    }

    function admin_enqueue_scripts()
    {
        $tab = $_GET['tab'] ?? 'settings';
        if ($tab == 'preview') {
            wp_enqueue_script('ajaxy-sf-search', AJAXY_SF_PLUGIN_URL . "js/app.js", array(), AJAXY_SF_VERSION, true);
        }
        if ($tab == 'shortcode') {
            wp_enqueue_script('ajaxy-sf-search', AJAXY_SF_PLUGIN_URL . "js/app.js", array(), AJAXY_SF_VERSION, true);

            wp_add_inline_script('ajaxy-sf-search', '
            jQuery(document).ready(function() {
                jQuery("#ajaxy-form").submit(function(e) {
                    var postData = jQuery(this).serializeArray();
                    jQuery.ajax({
                        url: ajaxurl,
                        type: "POST",
                        data: postData,
                        success: function(data, textStatus, jqXHR) {
                            jQuery("#shortcode-text").val(data);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            //if fails      
                        }
                    });
                    e.preventDefault(); //STOP default action
                    //e.unbind(); //unbind. to stop multiple form submit.
                    return false;
                });
                jQuery("#shortcode-text").dblclick(function() {
                    jQuery(this).select();
                });
            });', 'after');
        }

        wp_enqueue_style('ajaxy-sf-admin-styles', AJAXY_SF_PLUGIN_URL . "admin/css/styles.css");
        $this->enqueue_common_styles();
    }

    function enqueue_common_styles()
    {
        $themes = $this->get_installed_themes(AJAXY_THEMES_DIR, 'themes');
        $style = AJAXY_SF_PLUGIN_URL . "themes/default/style.css";
        $theme = $this->get_styles()['theme'] ?? '';
        if (isset($themes[$theme])) {
            $style = $themes[$theme]['stylesheet_url'];
        }
        if ($theme != 'blank') {
            wp_enqueue_style('ajaxy-sf-common', AJAXY_SF_PLUGIN_URL . "themes/common.css");
            wp_enqueue_style('ajaxy-sf-common-rtl', AJAXY_SF_PLUGIN_URL . "themes/common-rtl.css");
            wp_enqueue_style('ajaxy-sf-theme', $style);

            if (\file_exists(AJAXY_THEMES_DIR . $theme . '/theme.js')) {
                wp_enqueue_script('ajaxy-sf-theme', AJAXY_SF_PLUGIN_URL . 'themes/' . $theme . '/theme.js', array(), '1.0.0', true);
            }

            $css = $this->get_styles()['css'] ?? '';
            wp_add_inline_style('ajaxy-sf-theme', $css);
        }

        $styles = $this->get_styles(
            [
                'input_id' => '.sf_input',
                'search_url' => home_url() . '/?s=%s',
                'search_label' => 'Search',
                'delay' => 500,
                'width' => 180,
                'results_width' => 315,
                'results_width_unit' => 'px',
            ]
        );

        $settings = [
            'more' => $this->get_templates('more', 'more'),
            'boxes' => [
                [
                    'selector' => \trim($styles['input_id']),
                    'options' => array(
                        'searchUrl' => $styles['search_url'],
                        'text' => $styles['search_label'],
                        'delay' => $styles['delay'],
                        'iwidth' => $styles['width'],
                        'width' => $styles['results_width'] . $styles['results_width_unit'],
                        'ajaxUrl' => $this->get_ajax_url(),
                        'rtl' => $this->is_rtl()
                    )
                ]
            ],
        ];

        wp_add_inline_script('ajaxy-sf-search', 'var AjaxyLiveSearchSettings = ' . wp_json_encode($settings), 'before');
    }

    public function is_wpml()
    {
        return defined('ICL_LANGUAGE_CODE') || $this->wpml;
    }

    public function is_polylang()
    {
        return function_exists('pll_current_language');
    }

    public function is_qtrans()
    {
        return function_exists('qtrans_getLanguage');
    }


    public function is_rtl()
    {
        $styles = $this->get_styles()['rtl_theme'] ?? 1;
        /** @disregard */
        return $this->is_wpml() && substr('ar', 0, 2) == strtolower(ICL_LANGUAGE_CODE) || $this->is_qtrans() && substr('ar', 0, 2) == strtolower(qtrans_getLanguage()) || $this->is_polylang() && substr('ar', 0, 2) == strtolower(pll_current_language()) && $styles;
    }

    function get_ajax_url()
    {
        if ($this->is_wpml()) {
            /** @disregard */
            return admin_url('admin-ajax.php') . '?lang=' . ICL_LANGUAGE_CODE;
        }
        if ($this->is_qtrans()) {
            /** @disregard */
            return admin_url('admin-ajax.php') . '?lang=' . qtrans_getLanguage();
        }
        if ($this->is_polylang()) {
            /** @disregard */
            return admin_url('admin-ajax.php') . '?lang=' . pll_current_language();
        }
        return admin_url('admin-ajax.php');
    }
    function footer()
    {
        //echo $script;
    }
    function get_shortcode()
    {
        if (isset($_POST['sf'])) {
            $postData = $_POST['sf']['style'];
            $m = array();
            $border = "";
            foreach ($postData as $key => $value) {
                if (!empty($value)) {
                    switch ($key) {
                        case "b_width":
                            $border = $value . "px ";
                            break;
                        case "b_type":
                            $border .= $value . " ";
                            break;
                        case "b_color":
                            $border .= "#" . $value . " ";
                            break;
                        case "width":
                            $m[] = 'iwidth="' . $value . '"';
                            break;
                        case "results_width":
                            $m[] = sprintf('width="%s%s"', $value, $m['results_width_unit'] ?? 'px');
                            break;
                        case "post_types":
                            $m[] = 'post_types="' . implode(',', $value) . '"';
                            break;
                        default:
                            if ($key != "results_width_unit") {
                                $m[] = $key . '="' . $value . '"';
                            }
                            break;
                    }
                }
            }
            if ($border != "") {
                $m[] = 'border="' . trim($border) . '"';
            }
            echo '[ajaxy-live-search ' . implode(' ', $m) . ']';
        }
        exit;
    }
    function get_search_results()
    {
        $results = array();
        $sf_value = apply_filters('ajaxy_sf_value', $_POST['value']);
        if (!empty($sf_value)) {
            //filter taxonomies if set
            $arg_taxonomies = isset($_POST['taxonomies']) && trim($_POST['taxonomies']) != "" ? explode(',', trim($_POST['taxonomies'])) : array();
            // override post_types from input
            $arg_post_types = isset($_POST['post_types']) && trim($_POST['post_types']) != "" ? explode(',', trim($_POST['post_types'])) : array();

            $search = $this->get_search_objects(false, false, $arg_post_types, $arg_taxonomies);
            $author_searched = false;
            $authors = array();
            foreach ($search as $key => $object) {
                if ($object['type'] == 'post_type') {
                    $posts_result = $this->posts($sf_value, $object['name']);
                    if (sizeof($posts_result) > 0) {
                        $results[$object['name']][0]['all'] = $posts_result;
                        $results[$object['name']][0]['template'] = $this->get_templates($object['name'], 'post_type');
                        $results[$object['name']][0]['title'] = $object['label'];
                        $results[$object['name']][0]['class_name'] = 'sf-item' . (in_array($object['name'], self::$woocommerce_post_types) ? ' woocommerce' : '');
                    }
                } elseif ($object['type'] == 'taxonomy') {
                    if ($object['show_posts']) {
                        $taxonomy_result = $this->category($sf_value, $object['name'], $object['show_posts']);
                        if (sizeof($taxonomy_result) > 0) {
                            $cnt = 0;
                            foreach ($taxonomy_result as $key => $val) {
                                if (sizeof($val['posts']) > 0) {
                                    $results[$object['name']][$cnt]['all'] = $val['posts'];
                                    $results[$object['name']][$cnt]['template'] = $this->get_templates($object['name'], 'taxonomy');
                                    $results[$object['name']][$cnt]['title'] = $object['label'];
                                    $results[$object['name']][$cnt]['class_name'] = 'sf-category';
                                    $cnt++;
                                }
                            }
                        }
                    } else {
                        $taxonomy_result = $this->category($sf_value, $object['name']);
                        if (sizeof($taxonomy_result) > 0) {
                            $results[$object['name']][0]['all'] = $taxonomy_result;
                            $results[$object['name']][0]['template'] = $this->get_templates($object['name'], 'taxonomy');
                            $results[$object['name']][0]['title'] = $object['label'];
                            $results[$object['name']][0]['class_name'] = 'sf-category';
                        }
                    }
                } elseif ($object['type'] == 'role') {
                    $users = array();
                    if (!$author_searched) {
                        $authors = $this->author($sf_value, $object['name']);
                        $users = $this->filter_authors_by_role($authors, $object['name']);
                        $author_searched = true;
                    } else {
                        $users = $this->filter_authors_by_role($authors, $object['name']);
                    }
                    if (sizeof($users) > 0) {
                        $results[$object['name']][0]['all'] = $users;
                        $results[$object['name']][0]['template'] = $this->get_templates($object['name'], 'author');
                        $results[$object['name']][0]['title'] = $object['label'];
                        $results[$object['name']][0]['class_name'] = 'sf-category';
                    }
                }
            }
            $results = apply_filters('ajaxy_sf_results', $results);
            echo wp_json_encode($results);
        }
        do_action('ajaxy_sf_value_results', $sf_value, $results);
        exit;
    }
    function get_installed_themes($themeDir, $themeFolder)
    {
        $dirs = array();
        if ($handle = opendir($themeDir)) {
            while (($file = readdir($handle)) !== false) {
                if ('dir' == filetype($themeDir . $file)) {
                    if (trim($file) != '.' && trim($file) != '..') {
                        $dirs[] = $file;
                    }
                }
            }
            closedir($handle);
        }
        $themes = array();
        if (sizeof($dirs) > 0) {
            foreach ($dirs as $dir) {
                if (file_exists($themeDir . $dir . '/style.css')) {
                    $themes[$dir] = array(
                        'title' => $dir,
                        'stylesheet_dir' => $themeDir . $dir . '/style.css',
                        'stylesheet_url' => plugins_url($themeFolder . '/' . $dir . '/style.css', __FILE__),
                        'dir' => $themeDir . $dir,
                        'url' => plugins_url($themeFolder . '/' . $dir, __FILE__)
                    );
                }
            }
        }
        return $themes;
    }
    function admin_notice()
    {
        global $current_screen;
        if ($current_screen->parent_base == 'ajaxy-page' && isset($_GET['ajaxy-dismiss'])) {
            update_option('ajaxy-dismiss', 2);
        } elseif (isset($_GET['ajaxy-dismiss'])) {
            update_option('ajaxy-dismiss', 1);
        }
    }
    function form($settings)
    {
        $template = '<!-- Ajaxy Search Form v%s -->
		<div id="%s" class="sf-form-container">
			<form role="search" method="get" class="searchform" action="%s" >
				<div>
					<label class="screen-reader-text" for="s">%s</label>
					<div class="sf-search" style="border:%s">
						<span class="sf-block">
							<input style="width:%spx;" class="sf-input" autocomplete="off" type="text" value="%s" name="s" placeholder="%s" />
							<button class="sf-button searchsubmit" type="submit">
                            <svg viewBox="0 0 17 17" version="1.1" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16.604 15.868l-5.173-5.173c0.975-1.137 1.569-2.611 1.569-4.223 0-3.584-2.916-6.5-6.5-6.5-1.736 0-3.369 0.676-4.598 1.903-1.227 1.228-1.903 2.861-1.902 4.597 0 3.584 2.916 6.5 6.5 6.5 1.612 0 3.087-0.594 4.224-1.569l5.173 5.173 0.707-0.708zM6.5 11.972c-3.032 0-5.5-2.467-5.5-5.5-0.001-1.47 0.571-2.851 1.61-3.889 1.038-1.039 2.42-1.611 3.89-1.611 3.032 0 5.5 2.467 5.5 5.5 0 3.032-2.468 5.5-5.5 5.5z" fill="currentColor"></path>
                            </svg>
                            <span class="sf-hidden">%s</span></button>
						</span> 
					</div>
				</div>
			</form>
		</div>';
        $form = \sprintf(
            $template,
            AJAXY_SF_VERSION,
            $settings['id'],
            home_url('/'),
            esc_attr__('Search for:', AJAXY_SF_PLUGIN_TEXT_DOMAIN),
            $settings['border'] ?? '',
            $settings['iwidth'] ?? '',
            get_search_query(),
            $settings['label'],
            esc_attr__('Search', AJAXY_SF_PLUGIN_TEXT_DOMAIN)
        );
        if ($settings['credits'] == 1) {
            $form = $form . '<a style="display:none" href="http://www.ajaxy.org">Powered by Ajaxy</a>';
        }
        return $form;
    }

    function form_shortcode($atts = array())
    {
        $m = uniqid('sf');
        $scat = (array)$this->get_setting('category');

        $styles = $this->get_styles(array(
            'search_label' => 'Search',
            'search_url' => home_url() . '/?s=%s',
            'delay' => 500,
            'width' => 180,
            'results_width' => 315,
            'results_width_unit' => 'px',
            'border-width' => '1',
            'border-type' => 'solid',
            'border-color' => 'dddddd',
            'credits' => 1
        ));
        $settings = array(
            'id' => $m,
            'label' => $styles['search_label'],
            'width' => $styles['width'],
            'border' => $styles['border-width'] . "px " . $styles['border-type'] . " #" . $styles['border-color'],
            'credits' => $styles['credits'],
            'show_category' => isset($atts['show_category']) ?  $atts['show_category'] : $scat['show'],
            'show_post_category' => isset($atts['show_post_category']) ?  $atts['show_post_category'] : $scat['ushow'],
            'post_types' => ''
        );

        $settings = shortcode_atts($settings, $atts, 'ajaxy-live-search-layout');
        $form = $this->form($settings);


        $live_search_settings = array(
            'searchUrl' => $styles['search_url'],
            'text' => $settings['label'],
            'delay' => $styles['delay'],
            'iwidth' => $styles['width'],
            'width' => $styles['results_width'] . $styles['results_width_unit'],
            'ajaxUrl' => $this->get_ajax_url(),
            'ajaxData' => [
                'show_category' => $settings['show_category'],
                'show_post_category' => $settings['show_post_category'],
                'post_types' => $settings['post_types']
            ],
            'search' => false,
            'rtl' => $this->is_rtl()
        );

        $live_search_settings = shortcode_atts($live_search_settings, $atts, 'ajaxy-live-search');

        wp_add_inline_script('ajaxy-sf-search', 'var formSearch' . $m . ' = new SF("#' . $m . ' .sf-input", ' . wp_json_encode($live_search_settings) . ');', 'after');

        return $form;
    }
}
function ajaxy_search_form($settings = array())
{
    global $AjaxyLiveSearch;
    echo $AjaxyLiveSearch->form_shortcode($settings);
}
global $AjaxyLiveSearch;
$AjaxyLiveSearch = new SF();


?>