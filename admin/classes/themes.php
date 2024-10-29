<?php

/**
 * Themes table class.
 *
 * @package WordPress
 * @subpackage List_Table
 * @since 3.1.0
 * @access private
 */

namespace Ajaxy\LiveSearch\Admin\Classes;

if ( ! defined( 'ABSPATH' ) ) exit;

class Themes extends \WP_List_Table
{
    public function __construct()
    {
        parent::__construct(array(
            'plural' => 'Settings',
            'singular' => 'Setting',
        ));
    }

    function ajax_user_can()
    {
        return true;
    }

    function get_bulk_actions()
    {
        $actions = array();

        return $actions;
    }

    function current_action()
    {
        if (isset($_REQUEST['action']) && ('hide' == $_REQUEST['action'] || 'hide' == $_REQUEST['action2']))
            return 'bulk-hide';

        return parent::current_action();
    }

    function get_columns()
    {
        $columns = array(
            'title'    => __('Theme', AJAXY_SF_PLUGIN_TEXT_DOMAIN),
            'directory'        => __('Directory', AJAXY_SF_PLUGIN_TEXT_DOMAIN),
            'stylesheet_url'        => __('Stylesheet URL', AJAXY_SF_PLUGIN_TEXT_DOMAIN)
        );

        return $columns;
    }
    function get_column_info()
    {
        if (isset($this->_column_headers))
            return $this->_column_headers;

        $columns = $this->get_columns();
        $hidden = array();

        $this->_column_headers = array($columns, $hidden, $this->get_sortable_columns());

        return $this->_column_headers;
    }

    function get_sortable_columns()
    {
        return array();
    }

    function display_rows_or_placeholder()
    {
        global $AjaxyLiveSearch;
        $themes = $AjaxyLiveSearch->get_installed_themes(AJAXY_THEMES_DIR, 'themes');

        $fields = $AjaxyLiveSearch->get_post_types();
        $fields[] = (object)array('name' => 'category', 'labels' => (object)array('name' => 'Categories'));
        $args = wp_parse_args($this->callback_args, array(
            'page' => 1,
            'number' => 20,
            'search' => '',
            'hide_empty' => 0
        ));

        extract($args, EXTR_SKIP);

        $args['offset'] = $offset = ($page - 1) * $number;

        // convert it to table rows
        $out = '';
        $count = 0;


        if (sizeof($themes) > 0) {
            foreach ($themes as $theme) {
                $this->single_row($theme);
            }
        }
        if (empty($fields)) {
            echo '<tr class="no-items"><td class="colspanchange" colspan="' . $this->get_column_count() . '">';
            $this->no_items();
            echo '</td></tr>';
        } else {
            echo $out;
        }
    }

    function single_row($field, $level = 0)
    {
        static $row_class = '';

        /** @var \Ajaxy\LiveSearch\SF $AjaxyLiveSearch */
        global $AjaxyLiveSearch;
        $theme = $AjaxyLiveSearch->get_styles()['theme'] ?? '';
        $add_class = ($field['title'] == $theme ? 'row-yes' : 'row-no');
        $row_class = ($row_class == '' ? ' class="alternate ' . $add_class . '"' : ' class="' . $add_class . '"');

        echo '<tr id="type-sf-theme"' . $row_class . '>';
        echo $this->single_row_columns($field);
        echo '</tr>';
    }

    function column_cb($field)
    {
        return '<input type="checkbox" name="apply_theme[]" value="0" />';
    }
    function column_title($field)
    {
        /** @var \Ajaxy\LiveSearch\SF $AjaxyLiveSearch */
        global $AjaxyLiveSearch;
        //$pad = str_repeat( '&#8212; ', max( 0, $this->level ) );
        $name =  $field['title'];

        $edit_link = menu_page_url('ajaxy_sf_admin', false) . '&tab=themes&theme=' . $field['title'] . '&apply=1';
        $edit_link = wp_nonce_url($edit_link, 'hide-post_type_' . $field['title']);
        $out = '<strong><a class="row-title" href="' . $edit_link . '" title="' . esc_attr(sprintf(esc_html__('Edit &#8220;%s&#8221;'), $name)) . '">' . $name . '</a></strong><br />';

        $actions = array();

        $theme = $AjaxyLiveSearch->get_styles()['theme'] ?? 'default';
        if ($theme != $field['title']) :
            $actions['apply'] = "<a class='hide-field' href='" . $edit_link . "'>" . esc_html__('Apply theme', AJAXY_SF_PLUGIN_TEXT_DOMAIN) . "</a>";
        else :
            $actions['apply'] =  esc_html__('Current theme', AJAXY_SF_PLUGIN_TEXT_DOMAIN);
        endif;
        $out .= $this->row_actions($actions);
        $out .= '<div class="hidden" id="inline_' . $field['title'] . '">';
        $out .= '<div class="name">' . $field['title'] . '</div>';

        return $out;
    }
    function column_theme_name($field)
    {
        return $field['name'];
    }
    function column_directory($field)
    {
        return $field['dir'];
    }
    function column_stylesheet_url($field)
    {
        return '<a target="_blank" href="' . $field['stylesheet_url'] . '">' . $field['stylesheet_url'] . '</a>';
    }
    function column_default($field, $column_name)
    {
        return $field[$column_name];
    }

    /**
     * Outputs the hidden row displayed when inline editing
     *
     * @since 3.1.0
     */
    function inline_edit()
    {
    }
}
