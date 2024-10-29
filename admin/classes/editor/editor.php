<?php

namespace Ajaxy\LiveSearch\Admin\Classes\Editor;

if ( ! defined( 'ABSPATH' ) ) exit;

class Editor
{

    public function __construct()
    {
        add_action('enqueue_block_editor_assets', [$this, 'editor_assets']);

        add_filter('block_categories_all', array($this, 'add_category'), 10, 2);
        add_action('init', array($this, 'register_blocks'));
        add_filter('render_block_data', [$this, 'parse_block'], 10, 3);

        add_filter('register_block_type_args', function ($args, $name) {
            if ($name == 'core/group') {
                $args['render_callback'] = [$this, 'modify_blocks'];
            }
            return $args;
        }, 10, 3);
    }

    public function modify_blocks($attributes, $content)
    {
        return $content;
    }
    public function parse_block($parsed_block, $source_block = null, $parent_block = null)
    {
        if (isset($parsed_block['innerBlocks']) && sizeof($parsed_block['innerBlocks']) > 0) {
            $parsed_block['innerBlocks'] = $this->parse_block($parsed_block['innerBlocks'], $source_block, $parent_block);
        }
        return $parsed_block;
    }

    /**
     * Enqueue the block's assets for the editor.
     *
     * `wp-blocks`: includes block type registration and related functions.
     * `wp-element`: includes the WordPress Element abstraction for describing the structure of your blocks.
     * `wp-i18n`: To internationalize the block's text.
     *
     * @since 1.0.0
     * 
     * @return void
     */
    public function editor_assets()
    {
        // Scripts.
        wp_enqueue_script(
            'ajaxy-blocks', // Handle.
            AJAXY_SF_PLUGIN_URL . '/admin/js/editor.js', // Block.js: We register the block here.
            array('wp-blocks', 'wp-i18n', 'wp-element', 'wp-block-editor'), // Dependencies, defined above.
        );

        // Styles.
        wp_enqueue_style(
            'ajaxy-blocks-editor', // Handle.
            AJAXY_SF_PLUGIN_URL . '/admin/css/editor.css', // Block editor CSS.
            array('wp-edit-blocks')
        );
    }

    public function add_category($block_categories, $editor_context)
    {
        if (!empty($editor_context->post)) {
            array_push(
                $block_categories,
                array(
                    'slug'  => 'ajaxy-blocks',
                    'title' => __('Ajaxy', AJAXY_SF_PLUGIN_TEXT_DOMAIN),
                    'icon'  => null,
                )
            );
        }
        return $block_categories;
    }

    public function add_inline_script()
    {
        $json = [];
        $post_types = get_post_types('', 'objects');
        foreach ($post_types as $post_type) {
            $json[] = [
                'label' => $post_type->labels->singular_name . " (" . $post_type->name . ")",
                'value' => $post_type->name
            ];
        }

        wp_add_inline_script(
            'ajaxy-blocks',
            'var ajaxyBlocks = ' . wp_json_encode(
                array(
                    'widget' => array(
                        'post_types' => $json,
                        'search_url' => \home_url('/') . "?s=%s",
                        'preview' => AJAXY_SF_PLUGIN_URL . "/admin/img/preview-search.png",
                    ),
                )
            ) . ';',
            'before'
        );
    }

    /**
     * Registers block type
     * 
     * @return void
     */
    public function register_blocks()
    {
        $widgetData = include_once dirname(__FILE__) . '/src/blocks/widget/block.php';

        $blocks = [
            'widget' => [
                'attributes' => $widgetData['attributes'],
                'template' => 'widget',
                'title' => 'Ajaxy Instant Search',
            ]
        ];
        
        foreach ($blocks as $name => $block) {
            register_block_type(
                'ajaxy-blocks/' . $name,
                array(
                    'render_callback' => function ($block_attributes, $content) use ($block) {
                        return $this->get_template($block['template'], $block_attributes, $content);
                    },
                    'attributes' => $block['attributes'],
                    'title' => $block['title'] ?? '',
                )
            );
        }

        add_action('admin_enqueue_scripts', [$this, 'add_inline_script']);
    }

    public function get_template($template_name, $attributes, $content = '')
    {
        $located = dirname(__FILE__) . '/templates/' . $template_name . '.php';
        if (!file_exists($located)) {
            _doing_it_wrong(__FUNCTION__, sprintf(esc_html__('%s does not exist.', AJAXY_SF_PLUGIN_TEXT_DOMAIN), '<code>' . esc_html($located) . '</code>'), '1.0');
            return 'wrong';
        }

        ob_start();

        include $located;

        // Record output.
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }
}
