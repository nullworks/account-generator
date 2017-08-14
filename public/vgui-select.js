function vguiSelect($) {

    $('select').each(function() {
    	var self = $(this);
    	self.addClass('vgui-select-hidden');
    	self.wrap('<div class="nopad vgui-select-container noselect"></div>');
    	var el = $('<div class="nopad vgui-select"></div>');
    	self.after(el);
    	el.append('<div class="vgui-select-text nopad">Select</div>');
    	var list = $('<ul class="vgui-select-list vgui-outset"></ul>');
    	list.hide();
    	el.on('click', function(event) {
    		event.stopPropagation();
    		$('.vgui-select-active').not(this).each(function() {
    			$(this).removeClass('vgui-select-active');
    			$(this).find('.vgui-select-list').hide();
    		});
    		if (el.hasClass('vgui-select-active')) {
    			el.removeClass('vgui-select-active');
    			list.hide();
    		} else {
    			el.addClass('vgui-select-active');
    			list.show();
    		}
    	});
    	el.append(list);
    	var so = self.find('option')[0];
    	self.find('option').each(function() {
    		if ($(this).attr('selected')) so = $(this);
    		var opt = $('<li />');
    		opt.addClass('vgui-select-option');
    		opt.attr('data-value', $(this).val());
    		opt.text($(this).text());
    		opt.on('click', function() {
    			event.stopPropagation();
    			self.val($(this).attr('data-value'));
    			el.attr('data-value', $(this).text());
    			el.find('.vgui-select-text').text($(this).text());
    			el.removeClass('vgui-select-active');
    			list.hide();
    		});
    		list.append(opt);
    	});
    	if (so) {
    		el.attr('data-value', so.val());
    		el.find('.vgui-select-text').text(so.text());
    	}
    	$(document).on('click', function() {
    		el.removeClass('vgui-select-active');
    		list.hide();
    	});
    });

}
