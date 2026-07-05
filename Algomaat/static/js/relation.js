$(function () {


	$(".file").draggable({
		helper: "clone",
/*		function () {
			
			return $('<div class="drag-helper"></div>').get(0);
		},
*/		
/*		start: function(){
			$(this).style.left = 300;
			$(this).style.top = 300;
		},
*/
		revert: true,
		snap: true
	});
	
	$(".file").droppable({
		drop: function (event, ui) {
			var id1 = ui.draggable.attr("id").substr(5),
				id2 = this.id.substr(5),
				url = "/bucket/rel/publications/"+id1+"/"+id2;

			$.getJSON(url, function(json) {
				if(json.success){
					$('#modal-relation').modal({
						backdrop: true
					});
					$('#modal-relation').modal('show');
				} else {
					$('#modal-relation-false').modal({
						backdrop: true
					});
					$('#modal-relation-false').modal('show');				
				}
//			location.href = location.href;		
//				alert("JSON Data: " + json.success);
			});
//			location.href = url;
		}
	});
	
	$("#bucket").droppable({
		drop: function (event, ui) {
			var id = ui.draggable.attr("id").substr(5),
				url = "/bucket/add/publication/"+id;

			$.getJSON(url, function(json) {
				
				//alert("JSON Data: " + json.success);
			});
//			location.href = url;
		}
	});
});
